var this_vals = new Array();
var serlector_val = null;
var all_refresh_id = null;
  var tid = null;
  var mark = null;
  var cpu_status = null;
  var memory_status = null;
  var network_bytes_status = null;
  var network_packets = null;
horizon.d3_line_chart_ceilometer = {
  /**
   * A class representing the line chart
   * @param chart_module A context of horizon.d3_line_chart module.
   * @param html_element A html_element containing the chart.
   * @param settings An object containing settings of the chart.
   */
  LineChart: function(chart_module, html_element, settings){
    var self = this;
    var jquery_element = $(html_element);

    self.chart_module = chart_module;
    self.html_element = html_element;
    self.jquery_element = jquery_element;

    /************************************************************************/
    /*********************** Initialization methods *************************/
    /************************************************************************/
    /**
     * Initialize object
     */
    self.init = function() {
      var self = this;
      /* TODO(lsmola) make more configurable init from more sources */
      self.legend_element = $(jquery_element.data('legend-selector')).get(0);
      self.slider_element = $(jquery_element.data('slider-selector')).get(0);

      self.url = jquery_element.data('url');
      self.url_parameters = jquery_element.data('url_parameters');

      self.final_url = self.url;
      if (jquery_element.data('form-selector')){
        $(jquery_element.data('form-selector')).each(function(){
          // Add serialized data from all connected forms to url.
          if (self.final_url.indexOf('?') > -1){
            self.final_url += '&' + $(this).serialize();
          } else {
            self.final_url += '?' + $(this).serialize();
          }
        });
      }

      self.data = [];
      self.color = d3.scale.category10();

      // Self aggregation and statistic attrs
      self.stats = {};
      self.stats.average = 0;
      self.stats.last_value = 0;

      // Load initial settings.
      self.init_settings(settings);
      // Get correct size of chart and the wrapper.
      self.get_size();
    };
    /**
     * Initialize settings of the chart with default values, then applies
     * defined settings of the chart. Settings are obtained either from JSON
     * of the html attribute data-settings, or from init of the charts. The
     * highest priority settings are obtained directly from the JSON data
     * obtained from the server.
     * @param settings An object containing settings of the chart.
     */
    self.init_settings = function(settings) {
      var self = this;

      self.settings = {};
      self.settings.renderer = 'line';
      self.settings.auto_size = true;
      self.settings.axes_x = true;
      self.settings.axes_y = true;
      self.settings.interpolation = 'linear';
      // Static y axes values
      self.settings.yMin = undefined;
      self.settings.yMax = undefined;
      // Show last point as dot
      self.settings.higlight_last_point = false;

      // Composed charts wrapper
      self.settings.composed_chart_selector = '.overview_chart';
      // Bar chart component
      self.settings.bar_chart_selector = 'div[data-chart-type="overview_bar_chart"]';
      self.settings.bar_chart_settings = undefined;

      // allowed: verbose
      self.hover_formatter = 'verbose';

      /*
        Applying settings. The later application rewrites the previous
        therefore it has bigger priority.
      */

      // Settings defined in the init method of the chart
      if (settings){
        self.apply_settings(settings);
      }

      // Settings defined in the html data-settings attribute
      if (self.jquery_element.data('settings')){
        var inline_settings = self.jquery_element.data('settings');
        self.apply_settings(inline_settings);
      }
    };

    /**
     * Applies passed settings to the chart object. Allowed settings are
     * listed in this method.
     * @param settings An object containing settings of the chart.
     */
    self.apply_settings = function(settings){
      var self = this;

      var allowed_settings = ['renderer', 'auto_size', 'axes_x', 'axes_y',
        'interpolation', 'yMin', 'yMax', 'bar_chart_settings',
        'bar_chart_selector', 'composed_chart_selector',
        'higlight_last_point'];

      jQuery.each(allowed_settings, function(index, setting_name) {
        if (settings[setting_name] !== undefined){
          self.settings[setting_name] = settings[setting_name];
        }
      });
    };

    /**
     * Computes size of the chart from surrounding divs. When
     * settings.auto_size is on, it stretches the chart to bottom of
     * the screen.
     */
    self.get_size = function(){
      /*
        The height will be determined by css or window size,
        I have to hide everything inside that could mess with
        the size, so it is fully determined by outer CSS.
      */
      $(self.html_element).css('height', '');
      $(self.html_element).css('width', '');
      var svg = $(self.html_element).find('svg');
      svg.hide();

      /*
        Width an height of the chart will be taken from chart wrapper,
        that can be styled by css.
      */
      self.width = jquery_element.width();

      // Set either the minimal height defined by CSS.
      self.height = jquery_element.height();
      
      //alert(self.width);
      //alert(self.height);
      /*
        Or stretch it to the remaining height of the window if there
        is a place. + some space on the bottom, lets say 30px.
      */
      if (self.settings.auto_size) {
        var auto_height = $(window).height() - jquery_element.offset().top - 30;
        if (auto_height > self.height) {
          self.height = auto_height;
        }
      }

      /* Setting new sizes. It is important when resizing a window.*/
      $(self.html_element).css('height', self.height);
      $(self.html_element).css('width', self.width);
      svg.show();
      svg.css('height', self.height);
      svg.css('width', self.width);
    };

    /************************************************************************/
    /****************************** Initialization **************************/
    /************************************************************************/
    // Init of the object
    self.init();

    /************************************************************************/
    /****************************** Methods *********************************/
    /************************************************************************/
    /**
     * Obtains the actual chart data and renders the chart again.
     */
    self.refresh = function (){
      var self = this;
      var jsondata = {};

      self.start_loading();
      horizon.ajax.queue({
        url: self.final_url,
        success: function (data, textStatus, jqXHR) {
          // Clearing the old chart data.
          $(self.html_element).html('');
          $(self.legend_element).html('');

          self.series = data.series;
          //alert(JSON.stringify(self.series));
          //var arrayData = '[{"data":[{"y":339400000000,"x":"2014-05-21T01:20:27"},{"y":777720000000,"x":"2014-05-21T01:30:26"},{"y":1189190000000,"x":"2014-05-21T01:40:28"},{"y":1564360000000,"x":"2014-05-21T01:50:26"},{"y":1980900000000,"x":"2014-05-21T02:00:26"},{"y":2392800000000,"x":"2014-05-21T02:10:26"},{"y":2798900000000,"x":"2014-05-21T02:20:26"},{"y":3179030000000,"x":"2014-05-21T02:30:26"},{"y":3599250000000,"x":"2014-05-21T02:40:26"},{"y":3960380000000,"x":"2014-05-21T02:50:26"},{"y":4308910000000,"x":"2014-05-21T03:00:26"},{"y":4721660000000,"x":"2014-05-21T03:10:26"},{"y":5131770000000,"x":"2014-05-21T03:20:26"},{"y":5516480000000,"x":"2014-05-21T03:30:33"},{"y":5892820000000,"x":"2014-05-21T03:40:26"},{"y":6326920000000,"x":"2014-05-21T03:50:26"},{"y":6764540000000,"x":"2014-05-21T04:00:26"},{"y":7195780000000,"x":"2014-05-21T04:10:26"},{"y":7638790000000,"x":"2014-05-21T04:20:26"},{"y":8091740000000,"x":"2014-05-21T04:30:26"},{"y":8543600000000,"x":"2014-05-21T04:40:26"},{"y":8975890000000,"x":"2014-05-21T04:50:26"},{"y":9358850000000,"x":"2014-05-21T05:00:26"},{"y":9756140000000,"x":"2014-05-21T05:10:26"},{"y":10105340000000,"x":"2014-05-21T05:20:26"},{"y":10539590000000,"x":"2014-05-21T05:30:26"},{"y":10974870000000,"x":"2014-05-21T05:40:26"},{"y":11397550000000,"x":"2014-05-21T05:50:26"},{"y":11817840000000,"x":"2014-05-21T06:00:26"},{"y":12232660000000,"x":"2014-05-21T06:10:26"},{"y":12654580000000,"x":"2014-05-21T06:20:26"},{"y":13033550000000,"x":"2014-05-21T06:30:26"},{"y":13421490000000,"x":"2014-05-21T06:40:26"},{"y":13858210000000,"x":"2014-05-21T06:50:26"},{"y":14076560000000,"x":"2014-05-21T06:55:32"},{"y":14220482500000,"x":"2014-05-21T07:00:35"},{"y":14375117500000,"x":"2014-05-21T07:04:35"},{"y":14517303333333.334,"x":"2014-05-21T07:07:36"},{"y":14663457500000,"x":"2014-05-21T07:11:35"},{"y":14792916666666.666,"x":"2014-05-21T07:14:36"},{"y":14928785000000,"x":"2014-05-21T07:18:35"},{"y":15096167500000,"x":"2014-05-21T07:22:35"},{"y":15248673333333.334,"x":"2014-05-21T07:25:35"},{"y":15400537500000,"x":"2014-05-21T07:29:35"},{"y":15550343333333.334,"x":"2014-05-21T07:32:35"},{"y":15687712500000,"x":"2014-05-21T07:36:35"},{"y":15846337500000,"x":"2014-05-21T07:40:35"}],"name":"admin","unit":"ns"},{"data":[{"y":339400000000,"x":"2014-05-21T01:20:27"},{"y":777720000000,"x":"2014-05-21T01:30:26"},{"y":1189190000000,"x":"2014-05-21T01:40:28"},{"y":1464360000000,"x":"2014-05-21T01:50:26"},{"y":1880900000000,"x":"2014-05-21T02:00:26"},{"y":1392800000000,"x":"2014-05-21T02:10:26"},{"y":1798900000000,"x":"2014-05-21T02:20:26"},{"y":2179030000000,"x":"2014-05-21T02:30:26"},{"y":2599250000000,"x":"2014-05-21T02:40:26"},{"y":2960380000000,"x":"2014-05-21T02:50:26"},{"y":3308910000000,"x":"2014-05-21T03:00:26"},{"y":3721660000000,"x":"2014-05-21T03:10:26"},{"y":4131770000000,"x":"2014-05-21T03:20:26"},{"y":4516480000000,"x":"2014-05-21T03:30:33"},{"y":4892820000000,"x":"2014-05-21T03:40:26"},{"y":5326920000000,"x":"2014-05-21T03:50:26"},{"y":5764540000000,"x":"2014-05-21T04:00:26"},{"y":6195780000000,"x":"2014-05-21T04:10:26"},{"y":6638790000000,"x":"2014-05-21T04:20:26"},{"y":7091740000000,"x":"2014-05-21T04:30:26"},{"y":7543600000000,"x":"2014-05-21T04:40:26"},{"y":7975890000000,"x":"2014-05-21T04:50:26"},{"y":8358850000000,"x":"2014-05-21T05:00:26"},{"y":8756140000000,"x":"2014-05-21T05:10:26"},{"y":10095340000000,"x":"2014-05-21T05:20:26"},{"y":10439590000000,"x":"2014-05-21T05:30:26"},{"y":10874870000000,"x":"2014-05-21T05:40:26"},{"y":12397550000000,"x":"2014-05-21T05:50:26"},{"y":12817840000000,"x":"2014-05-21T06:00:26"},{"y":13232660000000,"x":"2014-05-21T06:10:26"},{"y":13654580000000,"x":"2014-05-21T06:20:26"},{"y":14033550000000,"x":"2014-05-21T06:30:26"},{"y":14421490000000,"x":"2014-05-21T06:40:26"},{"y":14858210000000,"x":"2014-05-21T06:50:26"},{"y":15076560000000,"x":"2014-05-21T06:55:32"},{"y":15220482500000,"x":"2014-05-21T07:00:35"},{"y":15375117500000,"x":"2014-05-21T07:04:35"},{"y":15517303333333.334,"x":"2014-05-21T07:07:36"},{"y":15663457500000,"x":"2014-05-21T07:11:35"},{"y":15792916666666.666,"x":"2014-05-21T07:14:36"},{"y":15928785000000,"x":"2014-05-21T07:18:35"},{"y":16096167500000,"x":"2014-05-21T07:22:35"},{"y":16248673333333.334,"x":"2014-05-21T07:25:35"},{"y":16400537500000,"x":"2014-05-21T07:29:35"},{"y":16550343333333.334,"x":"2014-05-21T07:32:35"},{"y":16687712500000,"x":"2014-05-21T07:36:35"},{"y":16846337500000,"x":"2014-05-21T07:40:35"}]}]';
          //alert(JSON.stringify(JSON.parse(arrayData)));
          //self.series = JSON.parse(arrayData);
          
          self.stats = data.stats;
          // The highest priority settings are sent with the data.
          self.apply_settings(data.settings);

          if (self.series.length <= 0) {
            $(self.html_element).html(gettext('No data available.'));
            $(self.legend_element).html('');
            // Setting a fix height breaks things when legend is getting
            // bigger.
            $(self.legend_element).css('height', '');
          } else {
            self.render();
          }
        },
        error: function (jqXHR, textStatus, errorThrown) {
          $(self.html_element).html(gettext('No data available.'));
          $(self.legend_element).html('');
          // Setting a fix height breaks things when legend is getting
          // bigger.
          $(self.legend_element).css('height', '');
          // FIXME add proper fail message
          horizon.alert('error', gettext('An error occurred. Please try again later.'));
        },
        complete: function (jqXHR, textStatus) {
          self.finish_loading();
        }
      });
    };

    /**
     * Renders the chart using Rickshaw library.
     */
    self.render = function(){
      var self = this;
      var last_point = undefined, last_point_color = undefined;

      $.map(self.series, function (serie) {
        serie.color = last_point_color = self.color(serie.name);
        $.map(serie.data, function (statistic) {
          // need to parse each date
          statistic.x = d3.time.format('%Y-%m-%dT%H:%M:%S').parse(statistic.x);
          statistic.x = statistic.x.getTime() / 1000;
          last_point = statistic;
          last_point.color = serie.color;
        });
      });

      var renderer = self.settings.renderer;
      if (renderer === 'StaticAxes'){
        renderer = Rickshaw.Graph.Renderer.StaticAxes;
      }

      // instantiate our graph!
      var graph = new Rickshaw.Graph({
        element: self.html_element,
        width: self.width,
        height: self.height,
        renderer: renderer,
        series: self.series,
        yMin: self.settings.yMin,
        yMax: self.settings.yMax,
        interpolation: self.settings.interpolation,
      });

      /*
        TODO(lsmola) add JQuery UI slider to make this work
        if (self.slider_element) {
          var slider = new Rickshaw.Graph.RangeSlider({
            graph: graph,
            element: $(self.slider_element)
          });
        }
      */
      graph.render();

      if (self.hover_formatter === 'verbose'){
        var hoverDetail = new Rickshaw.Graph.HoverDetail({
          graph: graph,
          formatter: function(series, x, y) {
            //var date = '<span class="date">' + new Date(x * 1000).toUTCString() + '</span>';
            var d = new Date(x * 1000);
            d.setTime(d.getTime()-(d.getTimezoneOffset()*60000));
            var date = '<span class="date">' + d.toString() + '</span>';
            var swatch = '<span class="detail_swatch" style="background-color: ' + series.color + '"></span>';
            var content = swatch + series.name + ': ' + parseFloat(y).toFixed(2) + ' ' + series.unit + '<br>' + date;
            return content;
          }
        });
      }

      if (self.legend_element) {
        var legend = new Rickshaw.Graph.Legend({
          graph: graph,
          element:  self.legend_element
        });

        var shelving = new Rickshaw.Graph.Behavior.Series.Toggle({
          graph: graph,
          legend: legend
        });

        var order = new Rickshaw.Graph.Behavior.Series.Order({
          graph: graph,
          legend: legend
        });

        var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight({
          graph: graph,
          legend: legend
        });
      }
      if (self.settings.axes_x) {
        var time = new Rickshaw.Fixtures.Time();
		var hours = time.unit('hour');
        var axes_x = new Rickshaw.Graph.Axis.Time({
          graph: graph,
          timeUnit: hours
        });
        axes_x.render();
      }
      if (self.settings.axes_y) {
        var axes_y = new Rickshaw.Graph.Axis.Y({
          graph: graph
        });
        axes_y.render();
      }
    };

    /**
     * Shows chart loader with backdrop. Backdrop is computed to hide
     * the canvas with chart. Loader is computed to be placed in the center.
     * Hides also a block with legend.
     */
    self.start_loading = function () {
      var self = this;

      /* Find and remove backdrops and spinners that could be already there.*/
      $(self.html_element).find('.modal-backdrop').remove();
      $(self.html_element).find('.spinner_wrapper').remove();

      // Display the backdrop that will be over the chart.
      self.backdrop = $('<div class="modal-backdrop"></div>');
      self.backdrop.css('width', self.width).css('height', self.height);
      $(self.html_element).append(self.backdrop);

      // Hide the legend.
      $(self.legend_element).html('').addClass('disabled');

      // Show the spinner.
      self.spinner = $('<div class="spinner_wrapper"></div>');
      $(self.html_element).append(self.spinner);
      /*
        TODO(lsmola) a loader for in-line tables spark-lines has to be
        prepared, the parameters of loader could be sent in settings.
      */
      self.spinner.spin(horizon.conf.spinner_options.line_chart);

      // Center the spinner considering the size of the spinner.
      var radius = horizon.conf.spinner_options.line_chart.radius;
      var length = horizon.conf.spinner_options.line_chart.length;
      var spinner_size = radius + length;
      var top = (self.height / 2) - spinner_size / 2;
      var left = (self.width / 2) - spinner_size / 2;
      self.spinner.css('top', top).css('left', left);
    };

    /**
     * Hides the loader and backdrop so the chart will become visible.
     * Shows also the block with legend.
     */
    self.finish_loading = function () {
      var self = this;
      // Showing the legend.
      $(self.legend_element).removeClass('disabled');
    };
  },

  /**
   * Function for initializing of the charts.
   * If settings['auto_resize'] is true, the chart will be refreshed when
   * the size of the window is changed. This option made only sense when
   * the size of the chart and its wrapper is not static.
   * @param selector JQuery selector of charts we want to initialize.
   * @param settings An object containing settings of the chart.
   */
  init: function(selector, settings) {
    var self = this;
    settings_val = settings;
    //this_vals = $(selector).first()
    all_refresh_id = setInterval(function(){inner_fun()},20000)
    function inner_fun() {
      console.log(111111111)
      console.log(all_refresh_id)
      this_vals = new Array();
      $(selector).each(function() {
        this_vals.push(this);
        self.refresh(this, settings);    
      });
    }
    if (settings !== undefined && settings.auto_resize) {

      /*
        I want to refresh chart on resize of the window, but only
        at the end of the resize. Nice code from mr. Google.
      */
      var rtime = new Date(1, 1, 2000, 12, 0, 0);
      var timeout = false;
      var delta = 400;
      $(window).resize(function() {
        rtime = new Date();
        if (timeout === false) {
          timeout = true;
          setTimeout(resizeend, delta);
        }
      });

      var resizeend = function() {
        if (new Date() - rtime < delta) {
          setTimeout(resizeend, delta);
        } else {
          timeout = false;
          $(selector).each(function() {
            self.refresh(this, settings);
          });
        }
      };
    }
    
    self.bind_commands(selector, settings);
  },

  /**
   * Function for creating chart objects, saving them for later reuse
   * and calling their refresh method.
   * @param html_element HTML element where the chart will be rendered.
   * @param settings An object containing settings of the chart.
   */
  refresh: function(html_element, settings){
    var chart = new this.LineChart(this, html_element, settings);
    /*
      FIXME save chart objects somewhere so I can use them again when
      e.g. I am switching tabs, or if I want to update them
      via web sockets
      this.charts.add_or_update(chart)
    */
    chart.refresh();
    
  },

  /**
   * Function for binding controlling commands to the chart. Like changing
   * timespan or various parameters we want to show in the chart. The
   * charts will be refreshed immediately after the form element connected
   * to them is changed.
   * @param selector JQuery selector of charts we are initializing.
   * @param settings An object containing settings of the chart.
   */
  bind_commands: function (selector, settings){
    // connecting controls of the charts
    var select_box_selector = 'select[data-line-chart-command="select_box_change"]';
    var datepicker_selector = 'input[data-line-chart-command="date_picker_change"]';
    var self = this;

    /**
     * Connecting forms to charts it controls. Each chart contains
     * JQuery selector data-form-selector, which defines by which
     * html Forms is a particular chart controlled. This information
     * has to be projected to forms. So when form input is changed,
     * all connected charts are refreshed.
     */
    connect_forms_to_charts = function(){
      $(selector).each(function() {
        var chart = $(this);
        $(chart.data('form-selector')).each(function(){
          var form = $(this);
          // each form is building a jquery selector for all charts it affects
          var chart_identifier = 'div[data-form-selector="' + chart.data('form-selector') + '"]';
          if (!form.data('charts_selector')){
            form.data('charts_selector', chart_identifier);
          } else {
            form.data('charts_selector', form.data('charts_selector') + ', ' + chart_identifier);
          }
        });
      });
    };

    /**
     * A helper function for delegating form events to charts, causing their
     * refreshing.
     * @param selector JQuery selector of charts we are initializing.
     * @param event_name Event name we want to delegate.
     * @param settings An object containing settings of the chart.
     */
    var id = null;
    delegate_event_and_refresh_charts = function(selector, event_name, settings) {
      $('form').delegate(selector, event_name, function() {
        /*
          Registering 'any event' on form element by delegating. This way it
          can be easily overridden / enhanced when some special functionality
          needs to be added. Like input element showing/hiding another element
          on some condition will be defined directly on element and can block
          this default behavior.
        */
        var invoker = $(this);
        var form = invoker.parents('form').first();

        $(form.data('charts_selector')).each(function(){
          // refresh the chart connected to changed form
          //id = setInterval(function(){inner_fun()}, 5000); 
          self.refresh(this, settings);
        });
      });
    };

    /**
     * A helper function for catching change event of form selectboxes
     * connected to charts.
     */
    bind_select_box_change = function(settings) {
      delegate_event_and_refresh_charts(select_box_selector, 'change', settings);
    };

    /**
     * A helper function for catching changeDate event of form datepickers
     * connected to charts.
     */
    bind_datepicker_change = function(settings) {
      var now = new Date();

      $(datepicker_selector).each(function() {
        var el = $(this);
        el.datepicker({format: 'yyyy-mm-dd',
          setDate: new Date(),
          showButtonPanel: true});
      });
      delegate_event_and_refresh_charts(datepicker_selector, 'changeDate', settings);
    };

    connect_forms_to_charts();
    bind_select_box_change(settings);
    bind_datepicker_change(settings);
  }
};

/* Init the graphs */
/*
horizon.addInitFunction(function () {
  horizon.d3_line_chart_ceilometer.init('div[data-chart-type="line_chart"]', {'auto_resize': true});
});
*/
