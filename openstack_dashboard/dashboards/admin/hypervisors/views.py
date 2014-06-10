# vim: tabstop=4 shiftwidth=4 softtabstop=4

# Copyright 2013 B1 Systems GmbH
#
#    Licensed under the Apache License, Version 2.0 (the "License"); you may
#    not use this file except in compliance with the License. You may obtain
#    a copy of the License at
#
#         http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
#    WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
#    License for the specific language governing permissions and limitations
#    under the License.

from django.utils.translation import ugettext_lazy as _

from datetime import datetime  # noqa
from datetime import timedelta  # noqa

from django.http import HttpResponse   # noqa
from django.template.defaultfilters import floatformat  # noqa
from django.views.generic import TemplateView  # noqa

from horizon import exceptions
from horizon import tables
from horizon import tabs
from horizon.utils import csvbase

from openstack_dashboard import api
from openstack_dashboard.api import ceilometer
from openstack_dashboard import usage

from openstack_dashboard.dashboards.admin.hypervisors \
    import tables as project_tables

from openstack_dashboard.dashboards.admin.hypervisors import constants
from openstack_dashboard.dashboards.admin.hypervisors \
    import tabs as project_tabs


class ResourceUsageCsvRenderer(csvbase.BaseCsvResponse):
    columns = [_("time"), _("value")]

    def get_row_data(self):
        for inst in self.context['series']:
            yield (inst[0], inst[1])


class AdminIndexView(tables.DataTableView):
    table_class = project_tables.AdminHypervisorsTable
    template_name = constants.INSTANCE_TEMPLATE_NAME

    def get_data(self):
        hypervisors = []
        try:
            hypervisors = api.nova.hypervisor_list(self.request)
#             hypervisors.sort(key=utils.natural_sort('hypervisor_hostname'))
        except Exception:
            exceptions.handle(self.request,
                _('Unable to retrieve hypervisor information.'))

        return hypervisors

    def get_context_data(self, **kwargs):
        context = super(AdminIndexView, self).get_context_data(**kwargs)
        try:
            context["stats"] = api.nova.hypervisor_stats(self.request)
        except Exception:
            exceptions.handle(self.request,
                _('Unable to retrieve hypervisor statistics.'))

        return context


class AdminDetailView(tabs.TabbedTableView):
    tab_group_class = project_tabs.InstanceInfoTabs
    template_name = constants.INSTANCE_DETAIL_TEMPLATE_NAME


class CsvView(TemplateView):
    usage_class = usage.BaseUsage
    csv_response_class = ResourceUsageCsvRenderer
    csv_template_name = "admin/hypervisors/detail.csv"

    @staticmethod
    def _series_for_meter(aggregates,
                          resource_name,
                          meter_name,
                          stats_name,
                          unit):
        """Construct datapoint series for a meter from resource aggregates."""
        series = []
        for resource in aggregates:
            if getattr(resource, meter_name):
                point = {'unit': unit,
                         'name': getattr(resource, resource_name),
                         'data': []}
                for statistic in getattr(resource, meter_name):
                    date = statistic.duration_end[:19]
                    value = float(getattr(statistic, stats_name))
                    point['data'].append({'x': date, 'y': value})
                series.append(point)
        return series

    def get_template_names(self):
        if self.request.GET.get('format', 'html') == 'csv':
            return (self.csv_template_name or
                     ".".join((self.template_name.rsplit('.', 1)[0], 'csv')))
        return self.template_name

    def get_content_type(self):
        if self.request.GET.get('format', 'html') == 'csv':
            return "text/csv"
        return "text/html"

    def render_to_response(self, context, **response_kwargs):
        if self.request.GET.get('format', 'html') == 'csv':
            render_class = self.csv_response_class
            response_kwargs.setdefault("filename", "usage.csv")
        else:
            render_class = self.response_class
        resp = render_class(request=self.request,
                            template=self.get_template_names(),
                            context=context,
                            content_type=self.get_content_type(),
                            **response_kwargs)
        return resp

    def get(self, request, *args, **kwargs):
        meter = request.GET.get('meter', None)
        meter_name = meter.replace(".", "_")
        date_options = request.GET.get('date_options', None)
        date_from = request.GET.get('date_from', None)
        date_to = request.GET.get('date_to', None)
        stats_attr = request.GET.get('stats_attr', None)
        group_by = request.GET.get('group_by', None)
        period = request.GET.get('period', None)
        resource_name = 'id' if group_by == "project" else 'resource_id'
        resource_id = request.GET.get('resource_id', None)

        meter_names = meter_name.split("-")
        if len(meter_names) > 1:
            series = []
            for meter_na in meter_names:
                meter_n = meter_na.replace("_", ".")
                resources, unit = query_data(request,
                                     date_from,
                                     date_to,
                                     date_options,
                                     group_by,
                                     meter_n,
                                     period)
                series = series + self._series_for_meter(resources,
                                        resource_name,
                                        meter_na,
                                        stats_attr,
                                        unit)
        else:
            resources, unit = query_data(request,
                                         date_from,
                                         date_to,
                                         date_options,
                                         group_by,
                                         meter,
                                         period)
            series = self._series_for_meter(resources,
                                            resource_name,
                                            meter_name,
                                            stats_attr,
                                            unit)

        self.kwargs['series'] = series

        self.kwargs['resource_id'] = resource_id
        self.kwargs['meter'] = meter
        self.kwargs['date_options'] = date_options
        self.kwargs['date_from'] = date_from
        self.kwargs['date_to'] = date_to
        self.kwargs['stats_attr'] = stats_attr
        self.kwargs['period'] = period

        return self.render_to_response(self.get_context_data(**kwargs))

    def get_context_data(self, **kwargs):
        context = super(CsvView, self).get_context_data(**kwargs)
        context['series'] = self.kwargs['series']

        context['resource_id'] = self.kwargs['resource_id']
        context['meter'] = self.kwargs['meter']
        context['date_options'] = self.kwargs['date_options']
        context['date_from'] = self.kwargs['date_from']
        context['date_to'] = self.kwargs['date_to']
        context['stats_attr'] = self.kwargs['stats_attr']
        context['period'] = self.kwargs['period']
        return context


def _calc_period(date_from, date_to):
    if date_from and date_to:
        if date_to < date_from:
            # TODO(lsmola) propagate the Value error through Horizon
            # handler to the client with verbose message.
            raise ValueError("Date to must be bigger than date "
                             "from.")
            # get the time delta in seconds
        delta = date_to - date_from
        if delta.days <= 0:
            # it's one day
            delta_in_seconds = 3600 * 24
        else:
            delta_in_seconds = delta.days * 24 * 3600 + delta.seconds
            # Lets always show 400 samples in the chart. Know that it is
        # maximum amount of samples and it can be lower.
        number_of_samples = 400
        period = delta_in_seconds / number_of_samples
    else:
        # If some date is missing, just set static window to one day.
        period = 3600 * 24
    return period


def _calc_date_args(date_from, date_to, date_options):
    # TODO(lsmola) all timestamps should probably work with
    # current timezone. And also show the current timezone in chart.
    if (date_options == "other"):
        try:
            if date_from:
                date_from = datetime.strptime(date_from,
                                              "%Y-%m-%d")
            else:
                # TODO(lsmola) there should be probably the date
                # of the first sample as default, so it correctly
                # counts the time window. Though I need ordering
                # and limit of samples to obtain that.
                pass
            if date_to:
                date_to = datetime.strptime(date_to,
                                            "%Y-%m-%d")
                # It return beginning of the day, I want the and of
                # the day, so i will add one day without a second.
                date_to = (date_to + timedelta(days=1) -
                           timedelta(seconds=1))
            else:
                date_to = datetime.now()
        except Exception:
            raise ValueError("The dates haven't been "
                             "recognized")
    elif(date_options == "null"):
        date_from = datetime.utcnow() - timedelta(hours=8)
        date_to = datetime.utcnow()
    else:
        try:
            date_from = datetime.now() - timedelta(days=int(date_options))
            date_to = datetime.now()
        except Exception:
            raise ValueError("The time delta must be an "
                             "integer representing days.")
    return date_from, date_to


def query_data(request,
               date_from,
               date_to,
               date_options,
               group_by,
               meter,
               period):
    date_from, date_to = _calc_date_args(date_from,
                                         date_to,
                                         date_options)
    if not period:
        period = _calc_period(date_from, date_to)
    additional_query = []
    if date_from:
        additional_query += [{'field': 'timestamp',
                              'op': 'ge',
                              'value': date_from}]
    if date_to:
        additional_query += [{'field': 'timestamp',
                              'op': 'le',
                              'value': date_to}]
    resource_id = request.GET.get('resource_id', None)
    if resource_id:
        additional_query += [{'field': 'resource_id', 'value': resource_id}]
    # TODO(lsmola) replace this by logic implemented in I1 in bugs
    # 1226479 and 1226482, this is just a quick fix for RC1
    try:
        meter_list = [m for m in ceilometer.meter_list(request)
                      if m.name == meter]
        unit = meter_list[0].unit
    except Exception:
        unit = ""
    if group_by == "project":
        try:
            tenants, more = api.keystone.tenant_list(
                request,
                domain=None,
                paginate=False)
        except Exception:
            tenants = []
            exceptions.handle(request,
                              _('Unable to retrieve tenant list.'))
        queries = {}
        for tenant in tenants:
            tenant_query = [{
                            "field": "project_id",
                            "op": "eq",
                            "value": tenant.id}]

            queries[tenant.name] = tenant_query

        ceilometer_usage = ceilometer.CeilometerUsage(request)
        resources = ceilometer_usage.resource_aggregates_with_statistics(
            queries, [meter], period=period, stats_attr=None,
            additional_query=additional_query)

    else:
        query = []

        def filter_by_meter_name(resource):
            """Function for filtering of the list of resources.

            Will pick the right resources according to currently selected
            meter.
            """
            for link in resource.links:
                if link['rel'] == meter:
                    # If resource has the currently chosen meter.
                    return True
            return False

        ceilometer_usage = ceilometer.CeilometerUsage(request)
        try:
            resources = ceilometer_usage.resources_with_statistics(
                query, [meter], period=period, stats_attr=None,
                additional_query=additional_query,
                filter_func=filter_by_meter_name)
        except Exception:
            resources = []
            exceptions.handle(request,
                              _('Unable to retrieve statistics.'))
    return resources, unit
