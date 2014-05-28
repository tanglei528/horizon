/* Namespace for core functionality related to DataTables. */
horizon.autoupdate = {
  update: function (div_id) {
    var $chart_to_update = $('tr.'+div_id+'.ajax-update');
    if ($chart_to_update.length) {
      var interval = $chart_to_update.attr('data-update-interval'),
        $table = $chart_to_update.closest('table'),
        decay_constant = $table.attr('decay_constant');

      // Do not update this row if the action column is expanded
      if ($chart_to_update.find('.actions_column .btn-group.open').length) {
        // Wait and try to update again in next interval instead
        setTimeout(horizon.autoupdate.update, interval);
        // Remove interval decay, since this will not hit server
        $table.removeAttr('decay_constant');
        return;
      }
      // Trigger the update handlers.
      $chart_to_update.each(function(index, row) {
        var $row = $(this),
          $table = $row.closest('table.datatable');
        horizon.ajax.queue({
          url: $row.attr('data-update-url'),
          error: function (jqXHR, textStatus, errorThrown) {
            switch (jqXHR.status) {
              // A 404 indicates the object is gone, and should be removed from the table
              case 404:
                // Update the footer count and reset to default empty row if needed
                var $footer, row_count, footer_text, colspan, template, params, $empty_row;

                // existing count minus one for the row we're removing
                row_count = horizon.autoupdate.update_footer_count($table, -1);

                if(row_count === 0) {
                  colspan = $table.find('th[colspan]').attr('colspan');
                  template = horizon.templates.compiled_templates["#empty_row_template"];
                  params = {
                      "colspan": colspan,
                      no_items_label: gettext("No items to display.")
                  };
                  empty_row = template.render(params);
                  $row.replaceWith(empty_row);
                } else {
                  $row.remove();
                }
                // Reset tablesorter's data cache.
                $table.trigger("update");
                break;
              default:
                horizon.utils.log(gettext("An error occurred while updating."));
                $row.removeClass("ajax-update");
                $row.find("i.ajax-updating").remove();
                break;
            }
          },
          success: function (data, textStatus, jqXHR) {
            var $new_row = $(data);

            if ($new_row.hasClass('status_unknown')) {
              var spinner_elm = $new_row.find("td.status_unknown:last");

              if ($new_row.find('.btn-action-required').length > 0) {
                spinner_elm.prepend(
                  $("<div />")
                    .addClass("action_required_img")
                    .append(
                      $("<img />")
                        .attr("src", "/static/dashboard/img/action_required.png")));
              } else {
                // Replacing spin.js here with an animated gif to reduce CPU
                spinner_elm.prepend(
                  $("<div />")
                    .addClass("loading_gif")
                    .append(
                      $("<img />")
                        .attr("src", "/static/dashboard/img/loading.gif")));
              }
            }

            // Only replace row if the html content has changed
            if($new_row.html() !== $row.html()) {
              if($row.find('.table-row-multi-select:checkbox').is(':checked')) {
                // Preserve the checkbox if it's already clicked
                $new_row.find('.table-row-multi-select:checkbox').prop('checked', true);
              }
              $row.replaceWith($new_row);
              // Reset tablesorter's data cache.
              $table.trigger("update");
              // Reset decay constant.
              $table.removeAttr('decay_constant');
            }
          },
          complete: function (jqXHR, textStatus) {
            // Revalidate the button check for the updated table


            // Set interval decay to this table, and increase if it already exist
            if(decay_constant === undefined) {
              decay_constant = 1;
            } else {
              decay_constant++;
            }
            $table.attr('decay_constant', decay_constant);
            // Poll until there are no rows in an "unknown" state on the page.
            next_poll = interval * decay_constant;
            // Limit the interval to 30 secs
            if(next_poll > 30 * 1000) { next_poll = 30 * 1000; }
            setTimeout(horizon.autoupdate.update, next_poll);
          }
        });
      });
    }
  }
};




horizon.addInitFunction(function() {
  var div_id = ["status_unknown","status_up","div3"]
  $.each(div_id, function(index,element){
    horizon.autoupdate.update(element);  
  })
  
});
