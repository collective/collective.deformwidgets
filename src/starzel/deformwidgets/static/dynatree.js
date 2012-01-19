//"use strict"
/* global _ */

_.templateSettings = {
    interpolate : /\{\{(.+?)\}\}/g
};


(function($){

    var DataModel = Backbone.Model.extend({
        initialize: function(){
            function change_params(model, params){
                var real_params = new Array();
                _.each(params.split('/'), function(param){
                    var pair = param.split(',');
	            var value = pair[1].replace(/^\s+|\s+$/g, "");
                    if (!isNaN(value)) { value = parseInt(value); };
                    if (value=='True') { value = true; };
                    if (value=='False') { value = false; };
	            real_params[pair[0].replace(/^\s+|\s+$/g, "")] = value;
                });
                model.set({params: real_params}, {silent: true});
            }

            _.bindAll(this, "update", "update_selected", "getDataFor");

            this.bind("change:params", change_params);

            this.trigger("change:params", this, this.get("params"));
            $.get(this.get("url"), {object_provides: this.get("object_provides")},
                  this.update);
        },
        defaults: {sparse: false},
        update_selected: function(selected){
            if (this.get("params").selectMode == 1){ // Single Select
                selected = [_.last(selected)];
            }
            this.set({selected: selected});
        },
        update: function(result){
            var new_children = JSON.parse(result);
            var new_selected = this.validateSelected(new_children);
            this.set({selected: new_selected}, {silent:true});
            this.set({children: new_children});
        },
        validateSelected: function(new_children){
            function get_keys(node){
                return [node.key].concat(_.map(node.children, get_keys));
            }
            var keys = _.flatten(_.map(new_children, get_keys));
            return _.intersection(keys, this.get("selected"));
        },
        getChildren: function(){
            var selected = this.get("selected");
            var filter = this.get("filter") && this.get("filter").toLowerCase();
            var sparse_cache = {};
            function map_no_false(elems, filter){
                return _.without(_.map(elems, filter), false);
            };
            function is_selected_or_has_selected_children(node){
                if (node.key in sparse_cache){
                    return sparse_cache[node.key];
                }
                if(_.detect(selected, function(selected_key){
                    return selected_key == node.key;
                })){
                    sparse_cache[node.key] = true;
                    return true;
                }else{
                    if(_.detect(node.children, function(child){
                        return is_selected_or_has_selected_children(child);
                    })){
                        sparse_cache[node.key] = true;
                        return true;
                    }
                }
                sparse_cache[node.key] = false;
                return false;
            };
            function remove_unselected(node){
                if(!is_selected_or_has_selected_children(node)){
                    return false;
                }
                var retval = _.clone(node);
                retval.children = map_no_false(retval.children, remove_unselected);
                return retval;
            }
            function remove_non_matching(node){
                if(!is_selected_or_has_selected_children(node)){
                    if (node.title.toLowerCase().indexOf(filter) != -1){
                        return _.clone(node);
                    }else{
                        var retval = _.clone(node);
                        retval.children = map_no_false(retval.children, remove_non_matching);
                        if(!!retval.children.length){
                            return retval;
                        }else{
                            return false;
                        }
                    }
                }
                var retv = _.clone(node);
                retv.children = map_no_false(retv.children, remove_non_matching);
                return retv;
            }
            function show_selected(node){
                if(_.detect(node.children, function(child){
                    return is_selected_or_has_selected_children(child);
                })){
                    node.expand = true;
                }
                _.each(node.children, show_selected);
            }
            var retval = this.get("children");
            if(this.get("sparse")){
                retval = map_no_false(retval, remove_unselected);
            }
            if(this.get("filter")){
                retval = map_no_false(retval, remove_non_matching);
            }
            _.each(retval, show_selected);
            return retval;
        },
        getDataFor: function(key){
            function getDataFromChildren(key, children){
                var retval = undefined;
                _.detect(children, function(child){
                    if(child.key == key){
                        retval = child;
                        return true;
                    }else{
                        var child_result = getDataFromChildren(key, child.children);
                        if(child_result !== undefined){
                            retval = child_result;
                            return true;
                        }
                    }
                    return false;
                });
                return retval;
            }
            return getDataFromChildren(key, this.get("children") || []);
        }
    });

    var Dynatree = Backbone.View.extend({
        initialize:function(){
            _.bindAll(this, "render");
            this.model.bind("change:children", this.render);
            this.model.bind("change:selected", this.render);
            this.model.bind("change:sparse", this.render);
            this.model.bind("change:filter", this.render);
        },
        render:function(model){
            var tree = this.el.dynatree("getTree");

            if(tree.getRoot === undefined){
                function onQuerySelect(selected, node){
                    if(!this.isUserEvent()){
                        return true;
                    }
                    var new_selected = model.get("selected");
                    var key = node.data.key;
                    if(selected){
                        new_selected = _.union(new_selected, [key]);
                    }else{
                        new_selected = _.without(new_selected, key);
                    }
                    model.update_selected(new_selected);
                    return false;
                }

                var params = _.extend({},
                                      this.model.get("params"),
                                      {children: this.model.getChildren(),
                                       onQuerySelect: onQuerySelect});
                this.el.dynatree(params);
                tree = this.el.dynatree("getTree");
            }else{
                tree.options.children = this.model.getChildren();
                tree.reload();
            }
            // We are faking here thet we are outside of the select event
            tree.phase = "idle";
            _.each(this.model.get("selected"), function(key){
                tree.getNodeByKey(key).select();
            });
        }
    });

    var HiddenForm = Backbone.View.extend({
        initialize: function(){
            _.bindAll(this, "render");
            var tmpl = this.el.find(".template");
            this.name = tmpl.attr("data-name");
            this.template = _.template(tmpl.wrap('<span />').parent().html());
            this.el.find(".template").remove();
            this.model.bind("change:selected", this.render);
        },
        render: function(){
            var val = "";
            var template = this.template;
            var name = this.name;
            var el = this.el;
            this.el.empty();
            _.each(this.model.get("selected"), function(key){
                var new_elem = template({name: name,
                                         value: key});
                el.append(new_elem);
            });
        }
    });

    var Filter = Backbone.View.extend({
        initialize: function(){
            _.bindAll(this, 'updateFilter', 'render');
            this.model.bind("change:filter", this.render);
        },
        events: {
            'keyup input': "updateFilter"
        },
        updateFilter: function(){
            var filter = this.el.find('.filter').val();
            this.model.set({'filter': filter});
            if(filter && this.model.get("sparse")){
                this.model.set({sparse: false});
            }
            return false;
        },
        render: function(){
            this.el.find('input').val(this.model.get("filter"));
        }

    });
    var VariousUIElements = Backbone.View.extend({
        initialize: function(){
            _.bindAll(this, "toggleSparse", "render");
            this.model.bind("change:sparse", this.render);
            this.render();
        },
        events: {
            "click .sparse": "toggleSparse"
        },
        toggleSparse: function(){
            if(!this.model.get("filter")){
                this.model.set({sparse: !this.model.get("sparse")});
                this.render();
            }
        },
        render: function(){
            if(this.model.get("sparse")){
                this.el.find(".sparse").text("Expand");
            }else{
                this.el.find(".sparse").text("Sparse");
            }
        }
    });

    var FlatListDisplay = Backbone.View.extend({
        initialize: function(){
            _.bindAll(this, "render", "delete_elem");
            this.template = _.template(this.el.find(".flatlist_template").html());
            this.model.bind("change:selected", this.render);
            this.model.bind("change:children", this.render);
        },
        events: {
            "click .delete": "delete_elem"
        },
        render: function(){
            var last_elem = undefined;
            var ordered_keys = this.getOrderedKeys();
            var model = this.model;
            var template = this.template;
            var el = this.el;
            var flatlist_items = this.el.find(".flatlist_item");
            _.each(flatlist_items.splice(1, flatlist_items.length), function(item){
                $(item).remove();
            });
            _.each(ordered_keys, function(key){
                var title = key;
                if(model.get("params").FlatListShow != "key"){
                    title = model.getDataFor(key).title;
                }
                var new_elem = template({title: title,
                                         key: key});
                if(last_elem === undefined){
                    el.append(new_elem);
                }else{
                    last_elem.after(new_elem);
                    last_elem = new_elem;
                }
            });
            el.append("<div class='visualClear'></div>");
        },
        getOrderedKeys: function(){
            var model = this.model;
            var sortFunc = function(key){
                return model.getDataFor(key).title;
            };
            if(this.model.get("params").FlatListShow == "key"){
                sortFunc = function(key){
                    return key;
                };
            }
            return _.sortBy(model.get("selected"), sortFunc);
        },
        delete_elem: function(event){
            var key = $(event.target).parent(".flatlist_item").attr("key");
            var new_selected = _.without(this.model.get("selected"), key);
            this.model.update_selected(new_selected);
        }
    });



    if(!window.starzel_deformwidgets){window.starzel_deformwidgets = {};}
    window.starzel_deformwidgets.initDynaTree = function(oid, children, presetKeys, selectMode, sequence_name, sequence_child_name){
        var target = $('#' + oid);
        if(!target.length){
            throw new ReferenceError("Targetelement #" + oid + " does not exist!");
        }
        target.dynatree({
            children:children,
            checkbox:true,
            selectMode:selectMode,
            onSelect : function(flag, node){
                if(selectMode == 3){
                    target.trigger('reset_elements', [target.dynatree('getSelectedNodes')]);
                }else{
                    if(flag){
                        if(selectMode == 2){
                            target.trigger("select_element", node.data);
                        }else if(selectMode == 1){
                            target.trigger("single_select_element", node.data);
                        }else{
                        }
                    }else{
                        target.trigger("unselect_element", node.data);
                    }
                }
            }
        });
        if(selectMode == 2 || selectMode == 3){
            target.append($('<div class="hidden-data">'+
                            '<input class="start" id="' + oid + '-selectedItems" type="hidden" name="__start__" value="' + sequence_name + ':sequence" />' +
                            '<input type="hidden" name="__end__" value="' + sequence_name + ':sequence" />' +
                            '</div>'+
                            '<ul class="dynatree-readonly"><li class="head">&nbsp;</li></ul>'));
        }else{
            target.append($('<div class="hidden-data"></div>'+
                            '<ul class="dynatree-readonly"><li class="head">&nbsp;</li></ul>'));
        }

        target.find('.dynatree-container').addClass('popupbox').hide().draggable().resizable().prepend('<div class="closeme">x</div>');
        target.find('.closeme').button().click(function(){target.find('.dynatree-container').toggle();});
        target.find('.dynatree-readonly li.head').click(function(){
            target.find('.dynatree-container').toggle();
        });
        function flatten(our_children){
            var retval = new Object();
            for(var i=0;i<our_children.length;i++){
                var search_term = our_children[i].title;
                retval[search_term] = our_children[i].key;
                if(our_children[i].children !== undefined) {
                    $.extend(retval, flatten(our_children[i].children, search_term));
                }
            }
            return retval;
        }
        var flat_list_to_keys = flatten(children);
        var completion_values = new Array();
        for(key in flat_list_to_keys){
            completion_values.push(key);
        }
        function selectInDynatree(value){
            var key = flat_list_to_keys[value];
            var node = target.dynatree('getTree').getNodeByKey(key);
            if(!!node) {
                node.select(!node.isSelected());
            }
        }
        target.prepend($('<input />').autocomplete({source:completion_values,
                                                    select:function(event, ui){
                                                        var new_key = ui.item.value;
                                                        selectInDynatree(new_key);
                                                        event.target.value = '';
                                                        return false;
                                                    }
                                                   }
                                                  )
                      ).keydown(function(event){
                          if(event.keyCode == 13){
                              // This is a workaround only need for multiselects
                              if(selectMode == 2 || selectMode == 3){
                                  var matches = $(event.target).data('autocomplete').widget().find('li').filter(function(){
                                      return $(this).data('item.autocomplete').value.indexOf(event.target.value) == 0;
                                  });
                                  /*if(matches.length == 1){
                                   selectInDynatree(matches.data('item.autocomplete').value);
                                   event.target.value = '';
                                   }*/
                                  return false;
                              }
                          }
                      });


        target.bind('select_element', function(event, node_data){
            target.find('div.hidden-data input.start').after($('<input class="sequence-items" type="hidden" name="' + sequence_child_name + '" value="' + node_data.key + '" />'));
        });
        target.bind('single_select_element', function(event, node_data){
            target.find('div.hidden-data input.single-item').remove();
            target.find('div.hidden-data').append($('<input class="single-item" type="hidden" name="' + sequence_name + '" value="' + node_data.key + '" />'));
        });
        target.bind('unselect_element', function(event, node_data){
            target.find('div.hidden-data input:hidden[value=' + node_data.key + ']').remove();
        });
        target.bind('select_element', function(event, node_data){
            target.find('ul.dynatree-readonly')
                .append($('<li class="content" key="' + node_data.key + '"><span class=\"nowrap\">'  +
                          node_data.title +
                          '<span class=\"delete deletesetup\">X</span></span>   </li>'));
            target.find('.deletesetup').button().click(function(){
                selectInDynatree(node_data.title);
            }).removeClass('deletesetup');
        });
        target.bind('single_select_element', function(event, node_data){
            target.find('ul.dynatree-readonly li.content').remove();
            target.find('ul.dynatree-readonly')
                .append($('<li class="content" key="' + node_data.key + '"><span class=\"nowrap\">' +
                          node_data.title +
                          '<span class=\"delete deletesetup\">X</span></span>    </li>'));
            target.find('.deletesetup').button().click(function(){
                selectInDynatree(node_data.title);
            }).removeClass('deletesetup');
        });
        target.bind('unselect_element', function(event, node_data){
            target.find('ul.dynatree-readonly li[key=' + node_data.key + ']').remove();
        });
        target.bind('reset_elements', function(event, nodes){
            var jq_target = target.find('ul.dynatree-readonly');
            jq_target.find('li.content').remove();
            for(var i=0;i<nodes.length;i++){
                (function(i){
                    var node = nodes[i];
                    jq_target
                        .append($('<li class="content" key="' +
                                  node.data.key +
                                  '"><span class=\"nowrap\">' +
                                  node.data.title +
                                  '<span class=\"delete deletesetup\">X</span></span>   </li>'));
                    jq_target.find('.deletesetup').button().click(function(){
                        selectInDynatree(node.data.title);
                    }).removeClass('deletesetup');
                })(i);
            }
        });
        target.bind('reset_elements', function(event, nodes){
            target.find('div.hidden-data input.sequence-items').remove();
            for(var i=0;i<nodes.length;i++){
                target.find('div.hidden-data input.start').after($('<input class="sequence-items" type="hidden" name="' + sequence_child_name + '" value="' + nodes[i].data.key + '" />'));
            }
        });

        for(var i=0;i<presetKeys.length;i++){
            var key = presetKeys[i];
            var tree = target.dynatree('getTree');
            tree.selectKey(key, true);
        }


    };
    window.starzel_deformwidgets.initDynaTreeContentBrowser = function(object_provides) {
        $('.dynatree-atwidget').each(function () {
	    // get parameters
	    var jqthis = $(this);
            var datamodel = new DataModel({url: jqthis.find(".dynatree_ajax_vocabulary").text(),
                                           selected: _.filter(jqthis.find("input.selected").map(function(){return $(this).val();}),
                                                              function(elem){return elem;}),
                                           params: jqthis.find('.dynatree_parameters').text(),
                                           object_provides: object_provides,
                                           name: jqthis.find('input.selected').attr('id')
                                          });
            jqthis.data('collective.dynatree', datamodel);
            var tree = new Dynatree({el: jqthis.find('.collective-dynatree-tree'),
                                     model: datamodel});
            var hiddeninput = new HiddenForm({el: jqthis.find(".hiddeninput"),
                                              model: datamodel});
            if(datamodel.get("params").filter){
                var filter = new Filter({el: jqthis.find(".dynatree_filter"),
                                         model: datamodel});
            }
            if(datamodel.get("params").sparse){
                var various = new VariousUIElements({el: jqthis.find(".ui_controls"),
                                                     model: datamodel});
            }
            if(datamodel.get("params").flatlist){
                var flatlist = new FlatListDisplay({el: jqthis.find(".flatlist_container"),
                                                    model: datamodel});
            }
        });
    };

})(jQuery);
