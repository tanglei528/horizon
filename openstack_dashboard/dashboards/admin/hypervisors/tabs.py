# Copyright 2012 Nebula, Inc.
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

from horizon import exceptions
from horizon import tabs

from openstack_dashboard import api

from openstack_dashboard.dashboards.admin.hypervisors import constants
from openstack_dashboard.dashboards.admin.hypervisors import tables


class InstanceTab(tabs.TableTab):
    table_classes = (tables.AdminHypervisorInstancesTable,)
    name = _("Hypervisor Instances")
    slug = "hypervisor_instances"
    template_name = constants.INSTANCE_DETAIL_TABLE_TEMPLATE_NAME

    def get_hypervisor_instances_data(self):
        instances = []
        request = self.tab_group.request
        hypervisor = self.tab_group.kwargs['hypervisor']
        try:
            result = api.nova.hypervisor_search(request, hypervisor)
            for hypervisor in result:
                try:
                    instances += hypervisor.servers
                except AttributeError:
                    pass
        except Exception:
            exceptions.handle(request,
                _('Unable to retrieve hypervisor instances list.'))
        return instances


class CurrentDetailTab(tabs.Tab):
    name = _("Hypervisor Instances Monitor")
    slug = "hypervisor_instances_monitor"
    template_name = constants.INSTANCE_MONITOR_TEMPLATE_NAME
    preload = False

    def get_context_data(self, request):
        instance = self.tab_group.kwargs['hypervisor']
        return {"instance": instance}


class InstanceInfoTabs(tabs.TabGroup):
    slug = "instance_details"
    tabs = (InstanceTab, CurrentDetailTab)
    sticky = True
