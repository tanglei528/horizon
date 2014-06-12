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

from openstack_dashboard import api

from openstack_dashboard.dashboards.admin.hypervisors \
    import tables as project_tables

from openstack_dashboard.dashboards.admin.hypervisors import constants
from openstack_dashboard.dashboards.admin.hypervisors \
    import tabs as project_tabs


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
