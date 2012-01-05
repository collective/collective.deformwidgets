//"use strict"
(function($){
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
    })
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
                      '<span class=\"delete deletesetup\">X</span></span>   </li>'))
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
})(jQuery);
