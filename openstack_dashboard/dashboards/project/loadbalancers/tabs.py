# vim: tabstop=4 shiftwidth=4 softtabstop=4

#    Copyright 2013, Big Switch Networks, Inc.
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

from openstack_dashboard.dashboards.project.loadbalancers import tables
from openstack_dashboard.dashboards.project.loadbalancers import utils


class PoolsTab(tabs.TableTab):
    table_classes = (tables.PoolsTable,)
    name = _("Pools")
    slug = "pools"
    template_name = "horizon/common/_detail_table.html"

    def get_poolstable_data(self):
        try:
            tenant_id = self.request.user.tenant_id
            pools = api.lbaas.pool_list(self.tab_group.request,
                                        tenant_id=tenant_id)
        except Exception:
            pools = []
            exceptions.handle(self.tab_group.request,
                              _('Unable to retrieve pools list.'))
        for p in pools:
            p.set_id_as_name_if_empty()
        return pools


class MembersTab(tabs.TableTab):
    table_classes = (tables.MembersTable,)
    name = _("Members")
    slug = "members"
    template_name = "horizon/common/_detail_table.html"

    def get_memberstable_data(self):
        try:
            tenant_id = self.request.user.tenant_id
            members = api.lbaas.member_list(self.tab_group.request,
                                            tenant_id=tenant_id)
        except Exception:
            members = []
            exceptions.handle(self.tab_group.request,
                              _('Unable to retrieve member list.'))
        for m in members:
            m.set_id_as_name_if_empty()
        return members


class MonitorsTab(tabs.TableTab):
    table_classes = (tables.MonitorsTable,)
    name = _("Monitors")
    slug = "monitors"
    template_name = "horizon/common/_detail_table.html"

    def get_monitorstable_data(self):
        try:
            tenant_id = self.request.user.tenant_id
            monitors = api.lbaas.pool_health_monitor_list(
                self.tab_group.request, tenant_id=tenant_id)
        except Exception:
            monitors = []
            exceptions.handle(self.tab_group.request,
                              _('Unable to retrieve monitor list.'))
        return monitors


class LoadBalancerTabs(tabs.TabGroup):
    slug = "lbtabs"
    tabs = (PoolsTab, MembersTab, MonitorsTab)
    sticky = True


class PoolDetailsTab(tabs.Tab):
    name = _("Pool Details")
    slug = "pooldetails"
    template_name = "project/loadbalancers/_pool_details.html"

    def get_context_data(self, request):
        pid = self.tab_group.kwargs['pool_id']
        try:
            pool = api.lbaas.pool_get(request, pid)
        except Exception:
            pool = []
            exceptions.handle(request,
                              _('Unable to retrieve pool details.'))
        for monitor in pool.health_monitors:
            display_name = utils.get_monitor_display_name(monitor)
            setattr(monitor, 'display_name', display_name)
        return {'pool': pool}


class VipDetailsTab(tabs.Tab):
    name = _("VIP Details")
    slug = "vipdetails"
    template_name = "project/loadbalancers/_vip_details.html"

    def get_context_data(self, request):
        vid = self.tab_group.kwargs['vip_id']
        try:
            vip = api.lbaas.vip_get(request, vid)
        except Exception:
            vip = []
            exceptions.handle(self.tab_group.request,
                              _('Unable to retrieve VIP details.'))
        return {'vip': vip}


class MemberDetailsTab(tabs.Tab):
    name = _("Member Details")
    slug = "memberdetails"
    template_name = "project/loadbalancers/_member_details.html"

    def get_context_data(self, request):
        mid = self.tab_group.kwargs['member_id']
        try:
            member = api.lbaas.member_get(request, mid)
        except Exception:
            member = []
            exceptions.handle(self.tab_group.request,
                              _('Unable to retrieve member details.'))
        return {'member': member}


class MonitorDetailsTab(tabs.Tab):
    name = _("Monitor Details")
    slug = "monitordetails"
    template_name = "project/loadbalancers/_monitor_details.html"

    def get_context_data(self, request):
        mid = self.tab_group.kwargs['monitor_id']
        try:
            monitor = api.lbaas.pool_health_monitor_get(request, mid)
        except Exception:
            monitor = []
            exceptions.handle(self.tab_group.request,
                              _('Unable to retrieve monitor details.'))
        return {'monitor': monitor}


class PoolDetailsTabs(tabs.TabGroup):
    slug = "pooltabs"
    tabs = (PoolDetailsTab,)


class VipDetailsTabs(tabs.TabGroup):
    slug = "viptabs"
    tabs = (VipDetailsTab,)


class MemberDetailsTabs(tabs.TabGroup):
    slug = "membertabs"
    tabs = (MemberDetailsTab,)


class MonitorDetailsTabs(tabs.TabGroup):
    slug = "monitortabs"
    tabs = (MonitorDetailsTab,)
