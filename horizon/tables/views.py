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

from collections import defaultdict

from django.views import generic

from horizon.templatetags.horizon import has_permissions  # noqa


class MultiTableMixin(object):
    """A generic mixin which provides methods for handling DataTables."""
    data_method_pattern = "get_%s_data"

    def __init__(self, *args, **kwargs):
        super(MultiTableMixin, self).__init__(*args, **kwargs)
        self.table_classes = getattr(self, "table_classes", [])
        self._data = {}
        self._tables = {}

        self._data_methods = defaultdict(list)
        self.get_data_methods(self.table_classes, self._data_methods)

    def _get_data_dict(self):
        if not self._data:
            for table in self.table_classes:
                data = []
                name = table._meta.name
                func_list = self._data_methods.get(name, [])
                for func in func_list:
                    data.extend(func())
                self._data[name] = data
        return self._data

    def get_data_methods(self, table_classes, methods):
        for table in table_classes:
            name = table._meta.name
            if table._meta.mixed_data_type:
                for data_type in table._meta.data_types:
                    func = self.check_method_exist(self.data_method_pattern,
                                                   data_type)
                    if func:
                        type_name = table._meta.data_type_name
                        methods[name].append(self.wrap_func(func,
                                                            type_name,
                                                            data_type))
            else:
                func = self.check_method_exist(self.data_method_pattern,
                                               name)
                if func:
                    methods[name].append(func)

    def wrap_func(self, data_func, type_name, data_type):
        def final_data():
            data = data_func()
            self.assign_type_string(data, type_name, data_type)
            return data
        return final_data

    def check_method_exist(self, func_pattern="%s", *names):
        func_name = func_pattern % names
        func = getattr(self, func_name, None)
        if not func or not callable(func):
            cls_name = self.__class__.__name__
            raise NotImplementedError("You must define a %s method "
                                      "in %s." % (func_name, cls_name))
        else:
            return func

    def assign_type_string(self, data, type_name, data_type):
        for datum in data:
            setattr(datum, type_name, data_type)

    def get_tables(self):
        if not self.table_classes:
            raise AttributeError('You must specify one or more DataTable '
                                 'classes for the "table_classes" attribute '
                                 'on %s.' % self.__class__.__name__)
        if not self._tables:
            for table in self.table_classes:
                if not has_permissions(self.request.user,
                                       table._meta):
                    continue
                func_name = "get_%s_table" % table._meta.name
                table_func = getattr(self, func_name, None)
                if table_func is None:
                    tbl = table(self.request, **self.kwargs)
                else:
                    tbl = table_func(self, self.request, **self.kwargs)
                self._tables[table._meta.name] = tbl
        return self._tables

    def get_context_data(self, **kwargs):
        context = super(MultiTableMixin, self).get_context_data(**kwargs)
        tables = self.get_tables()
        for name, table in tables.items():
            context["%s_table" % name] = table
        return context

    def has_more_data(self, table):
        return False

    def has_previous_data(self, table):
        marker = self.request.GET.get(
            table._meta.pagination_param, None)
        if marker is not None:
            return True
        return False

    def current_page(self, table):
        marker = self.request.GET.get(
            table._meta.pagination_param, None)
        current_page = self.request.session.get("current_page", 1)
        pagination_id = self.request.session.get("pagination_id", None)
        if marker is None:
            self.request.session["current_page"] = 1
            self.request.session["pagination_id"] = None
        else:
            if pagination_id is None:
                self.request.session["pagination_id"] = [marker, ]
                self.request.session['current_page'] = \
                    current_page + 1
            elif marker in pagination_id:
                self.request.session['current_page'] = \
                    current_page - 1
                self.request.session["pagination_id"].pop()
            else:
                self.request.session["pagination_id"].append(marker)
                self.request.session['current_page'] = \
                    current_page + 1
        return self.request.session['current_page']

    def handle_table(self, table):
        name = table.name
        data = self._get_data_dict()
        self._tables[name].data = data[table._meta.name]
        self._tables[name]._meta.has_more_data = self.has_more_data(table)
        self._tables[name]._meta.current_page = self.current_page(table)
        self._tables[name]._meta.has_previous_data = \
            self.has_previous_data(table)
        handled = self._tables[name].maybe_handle()
        return handled


class MultiTableView(MultiTableMixin, generic.TemplateView):
    """A class-based generic view to handle the display and processing of
    multiple :class:`~horizon.tables.DataTable` classes in a single view.

    Three steps are required to use this view: set the ``table_classes``
    attribute with a tuple of the desired
    :class:`~horizon.tables.DataTable` classes;
    define a ``get_{{ table_name }}_data`` method for each table class
    which returns a set of data for that table; and specify a template for
    the ``template_name`` attribute.
    """
    def construct_tables(self):
        tables = self.get_tables().values()
        # Early out before data is loaded
        for table in tables:
            preempted = table.maybe_preempt()
            if preempted:
                return preempted
        # Load data into each table and check for action handlers
        for table in tables:
            handled = self.handle_table(table)
            if handled:
                return handled

        # If we didn't already return a response, returning None continues
        # with the view as normal.
        return None

    def get(self, request, *args, **kwargs):
        handled = self.construct_tables()
        if handled:
            return handled
        context = self.get_context_data(**kwargs)
        return self.render_to_response(context)

    def post(self, request, *args, **kwargs):
        # GET and POST handling are the same
        return self.get(request, *args, **kwargs)


class DataTableView(MultiTableView):
    """A class-based generic view to handle basic DataTable processing.

    Three steps are required to use this view: set the ``table_class``
    attribute with the desired :class:`~horizon.tables.DataTable` class;
    define a ``get_data`` method which returns a set of data for the
    table; and specify a template for the ``template_name`` attribute.

    Optionally, you can override the ``has_more_data`` method to trigger
    pagination handling for APIs that support it.
    """
    table_class = None
    context_object_name = 'table'

    def _get_data_dict(self):
        if not self._data:
            self._data = {self.table_class._meta.name: self.get_data()}
        return self._data

    def get_data(self):
        raise NotImplementedError('You must define a "get_data" method on %s.'
                                  % self.__class__.__name__)

    def get_tables(self):
        if not self._tables:
            self._tables = {}
            if has_permissions(self.request.user,
                               self.table_class._meta):
                self._tables[self.table_class._meta.name] = self.get_table()
        return self._tables

    def get_table(self):
        # Note: this method cannot be easily memoized, because get_context_data
        # uses its cached value directly.
        if not self.table_class:
            raise AttributeError('You must specify a DataTable class for the '
                                 '"table_class" attribute on %s.'
                                 % self.__class__.__name__)
        if not hasattr(self, "table"):
            self.table = self.table_class(self.request, **self.kwargs)
        return self.table

    def get_context_data(self, **kwargs):
        context = super(DataTableView, self).get_context_data(**kwargs)
        if hasattr(self, "table"):
            context[self.context_object_name] = self.table
        return context


class MixedDataTableView(DataTableView):
    """A class-based generic view to handle DataTable with mixed data
    types.

    Basic usage is the same as DataTableView.

    Three steps are required to use this view:
    #. Set the ``table_class`` attribute with desired
    :class:`~horizon.tables.DataTable` class. In the class the
    ``data_types`` list should have at least two elements.

    #. Define a ``get_{{ data_type }}_data`` method for each data type
    which returns a set of data for the table.

    #. Specify a template for the ``template_name`` attribute.
    """
    table_class = None
    context_object_name = 'table'

    def _get_data_dict(self):
        if not self._data:
            table = self.table_class
            self._data = {table._meta.name: []}
            for data_type in table.data_types:
                func_name = "get_%s_data" % data_type
                data_func = getattr(self, func_name, None)
                if data_func is None:
                    cls_name = self.__class__.__name__
                    raise NotImplementedError("You must define a %s method "
                                              "for %s data type in %s." %
                                              (func_name, data_type, cls_name))
                data = data_func()
                self.assign_type_string(data, data_type)
                self._data[table._meta.name].extend(data)
        return self._data

    def assign_type_string(self, data, type_string):
        for datum in data:
            setattr(datum, self.table_class.data_type_name,
                    type_string)

    def get_table(self):
        self.table = super(MixedDataTableView, self).get_table()
        if not self.table._meta.mixed_data_type:
            raise AttributeError('You must have at least two elements in '
                                 'the data_types attribute '
                                 'in table %s to use MixedDataTableView.'
                                 % self.table._meta.name)
        return self.table
