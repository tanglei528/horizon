# vim: tabstop=4 shiftwidth=4 softtabstop=4

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

import horizon


class BasePanels(horizon.PanelGroup):
    slug = "compute"
    name = _("Compute")
    panels = ('instances',
              'images',)


class NetworkPanels(horizon.PanelGroup):
    slug = "network"
    name = _("Network Panel")
    panels = ('network_topology',
              'networks',
              'routers',
              'loadbalancers',
              'firewalls',
              'vpn',)


class ObjectStorePanels(horizon.PanelGroup):
    slug = "object_store"
    name = _("Object Store")
    panels = ('containers',)


class OrchestrationPanels(horizon.PanelGroup):
    name = _("Orchestration")
    slug = "orchestration"
    panels = ('stacks',)


class DatabasePanels(horizon.PanelGroup):
    name = _("Databases")
    slug = "database"
    panels = ('databases',
              'database_backups',)


class StoragePanels(horizon.PanelGroup):
    slug = "storage"
    name = _("Storage")
    panels = ('volumes',)


class SummaryPanels(horizon.PanelGroup):
    slug = "summary"
    # No need to show this group in navigation.
    #name = _("Summary")
    panels = ('overview',)


class SecurityPanels(horizon.PanelGroup):
    slug = "security"
    name = _("Security")
    panels = ('access_and_security',)


class Project(horizon.Dashboard):
    name = _("Project")
    slug = "project"
    panels = (
        SummaryPanels,
        BasePanels,
        StoragePanels,
        NetworkPanels,
        SecurityPanels,
        ObjectStorePanels,
        OrchestrationPanels,
        DatabasePanels,)
    default_panel = 'overview'
    supports_tenants = True


horizon.register(Project)
