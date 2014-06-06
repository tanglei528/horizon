var refresh_time = 60000;
var interval_ids = '';
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
	  if(jquery_element.attr('data-display')=='false'){
	  	return false;
	  }
      self.start_loading();
      horizon.ajax.queue({
        url: self.final_url,
        success: function (data, textStatus, jqXHR) {
          // Clearing the old chart data.
          $(self.html_element).html('');
          $(self.legend_element).html('');

          self.series = data.series;
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
          if (jqXHR.status != 0) {
            horizon.alert('error', gettext('An error occurred. Please try again later.'));
          }
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
	  var count = 0;
	  
      var ymax = 0; //The maximum value of y axis
      
      var total = 0; //total of value of y axis
      var num = 0; //total of x axis
      var flag_unit = false; // unit conver flag
      var n = 0; // conver number
      
      $.map(self.series, function (serie) {
      	count ++;
        serie.color = last_point_color = self.color(serie.name);
        if(count ==2){
        	serie.color = last_point_color = "#30c020";
        }
        if(jquery_element.attr('data-unit-conver')=='true'){
	        $.map(serie.data, function (statistic) {
	        	num ++;
	        	total = total + statistic.y;
	        });
	        var avg = total / num;
	        var unit = getValue(serie.unit);
	        n = mi(avg, unit, n);
	        var afterNum = after(serie.unit);
	        if (n > afterNum) {
	        	n = afterNum;
	        }
	        if (n > 0) {
	        	flag_unit = true;
	        }
        }
        if (flag_unit) {
        	serie.unit = converUnit(serie.unit, n);
        }
        $.map(serie.data, function (statistic) {
          // need to parse each date
          statistic.x = d3.time.format('%Y-%m-%dT%H:%M:%S').parse(statistic.x);
          statistic.x = statistic.x.getTime() / 1000;
          last_point = statistic;
          last_point.color = serie.color;
          if (flag_unit) {
        	  for (var i=0; i<n; i++) {
        		  statistic.y = statistic.y / unit;
        	  }
          }
          if (statistic.y > ymax) {
        	  ymax = statistic.y;
          }
        });
        ymax = ymax * 100 / 70;
        self.apply_settings({'yMax': ymax});
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
        min: self.settings.yMin,
        max: self.settings.yMax,
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
  init: function(selector, settings, autoRefresh) {
    var self = this;
    $(selector).each(function() {
        self.refresh(this, settings, autoRefresh);    
      });
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
  },
  /**
   * Function for creating chart objects, saving them for later reuse
   * and calling their refresh method.
   * @param html_element HTML element where the chart will be rendered.
   * @param settings An object containing settings of the chart.
   */
  refresh: function(html_element, settings, autoRefresh){
    var chart = new this.LineChart(this, html_element, settings);
    /*
      FIXME save chart objects somewhere so I can use them again when
      e.g. I am switching tabs, or if I want to update them
      via web sockets
      this.charts.add_or_update(chart)
    */
    chart.refresh();
    if (autoRefresh) {
    	interval_ids = setInterval(function(){inner_fun()},refresh_time);
    }
    function inner_fun(){
    	horizon.d3_line_chart_ceilometer.refresh(html_element,settings);
        clearInterval(interval_ids);
    }
  },
  switchTime: function(){
  	var value = $('#stats_attr').val();
  	refresh_time = value;

  	horizon.d3_line_chart_ceilometer.init('div[data-chart-type="line_chart"]', {'auto_resize': true}, true);
  },
  showCPU: function(){
    var cupdiv = $('#cpu_cup_util');
    var elem = $(cupdiv).find('.chart');
    var bgimage = $('#cpu_title_image');
    this.switchImage(cupdiv,bgimage,elem);
  },
  
  showMemory: function(){
  	var memorydiv = $('#memory_memory_usage');
    var elem = $(memorydiv).find('.chart');
    var bgimage = $('#memory_title_image');
  	this.switchImage(memorydiv,bgimage,elem);
  },
  showNetworkBytes: function(){
  	var networkBytediv = $('#network_bytes');
    var elem = $(networkBytediv).find('.chart');
    var bgimage = $('#network_bytes_image');
  	this.switchImage(networkBytediv,bgimage,elem);
  },
  showNetworkPackets: function(){
  	var networkPacketdiv = $('#network_packets');
    var elem = $(showNetworkPackets).find('.chart');
    var bgimage = $('#network_packets_image');
  	this.switchImage(networkPacketdiv,bgimage,elem);
  },
  switchImage: function(obj,bgimage,elem){
  	if(obj.css('display')=="none"){
  		obj.css('display','block');
  		elem.attr('data-display',true);
  		bgimage.css("background-image","url(/static/dashboard/img/drop_arrow_l2.png)");
  	}else{
  		obj.css('display','none');
  		elem.attr('data-display',false);
  		bgimage.css("background-image","url(/static/dashboard/img/right_droparrow_l2.png)");
  	}
    
  }
};
var timeUnit = ['ns','us','ms','s'];
var bitUnit = ['B','KB','MB','GB','TB','PB','EB','ZB','YB','NB','DB'];
var packUnit = ['packet','K packet'];
var proUnit = ['process','K process'];
/**
 * the unit when 'unit' convert 'n' times 
 */
function converUnit(unit, n) {
	n = parseInt(n);
	var unitRes = unit;
	var tIndex = contains(timeUnit, unit);
	tIndex = parseInt(tIndex);
	if (tIndex != -1) {
		if (tIndex + n < timeUnit.length) {
			unitRes = timeUnit[tIndex + n];
			return unitRes;
		}
	}
	var bIndex = contains(bitUnit, unit);
	bIndex = parseInt(bIndex);
	if (bIndex != -1) {
		if (bIndex + n < bitUnit.length) {
			unitRes = bitUnit[bIndex + n];
			return unitRes;
		}
	}
	var paIndex = contains(packUnit, unit);
	paIndex = parseInt(paIndex);
	if (paIndex != -1) {
		if (paIndex + n < packUnit.length) {
			unitRes = packUnit[paIndex + n];
			return unitRes;
		}
	}
	var prIndex = contains(proUnit, unit);
	prIndex = parseInt(prIndex);
	if (prIndex != -1) {
		if (prIndex + n < prIndex.length) {
			unitRes = proUnit[prIndex + n];
			return unitRes;
		}
	}
	return unitRes;
}
/**
 * how many object after 'unit' in array
 */
function after(unit) {
	var n = 0;
	var tIndex = contains(timeUnit, unit);
	if (tIndex != -1) {
		n = timeUnit.length - 1 - tIndex;
		return n;
	}
	var bIndex = contains(bitUnit, unit);
	if (bIndex != -1) {
		n = bitUnit.length - 1 - bIndex;
		return n;
	}
	var paIndex = contains(packUnit, unit);
	if (paIndex != -1) {
		n = packUnit.length - 1 - paIndex;
		return n;
	}
	var prIndex = contains(proUnit, unit);
	if (prIndex != -1) {
		n = proUnit.length - 1 - prIndex;
		return n;
	}
	return n;
}
/**
 * if array containing object, return index
 * else return -1.
 */
function contains(arr, obj) { 
	var num = -1;
	for (var i=0 ;i<arr.length;i++) {  
		if (arr[i] == obj) {
			num = i;
			break;     
		} 
	} 
	return num;
}
/**
 * Recursive function 
 * for example: 
 * num 789 unit 1024 n 0 return n 0
 * num 123456 unit 1000 n 0 return 1
 * num 12345678 unit 1000 n 0 return 2
 */
function mi(num, unit, n) {
	if (unit == 1) { 
		return n;
	}
	if (num > unit) {
		n = n+1;
	    if (num/unit > unit) {
	       return mi(num/unit, unit, n);
	    } else {
	    	return n;
	    }
	} else {
		return n;
	}
}
function getValue(unit) {
	var val;
	if (unit == 'ns' || unit == 'packet' || unit == 'process') {
		val = 1000;
	} else if (unit == 'B' || unit == 'MB') {
		val = 1024;
	} else {
		val = 1;
	}
	return val;
}
/* Init the graphs */
/*
horizon.addInitFunction(function () {
  horizon.d3_line_chart_ceilometer.init('div[data-chart-type="line_chart"]', {'auto_resize': true});
});
*/
