//
// omg.js
//

// CKAN Querybuilder example application
//

// Coding begins
(function(context, namespace){

    // Begin basic JS improvements

    function definedp(that){
        return typeof that !='undefined';
    }

    $.fn.hasAttr = function(name) {
        return this.attr(name) !== undefined;
    };

    // case insensitive text search
    $.expr[':']['icontains'] = function(node, index, props){
        return node.innerText.upper().search(props[3].upper()) !== -1;
    }

    String.prototype.capitalize = function() {
        return this.charAt(0).upper() + this.slice(1);
    }

    String.prototype.chomp = function() {
        return this.trim();
    }
    String.prototype.upper = function() {
        return this.toUpperCase();
    }

    // End Js basics

    // Begin application
    var OMG = context[namespace] = {
        backbone:    {},
        models:      {},
        collections: {},
        views:       {},
        widgets:     {},
        templates:   {},

        // State
        db: {},

        // Configurations
        config: {
            ckan_url: 'https://data.england.nhs.uk'
        },
        
        initialize: function(opts){
            this.config = _.extend(this.config, opts);
            this.ckan = new CKAN.Client(this.config.ckan_url);

            // Set up views 
            this.package_list = new OMG.views.PackageListView();
            this.querybuilder = new OMG.views.QueryBuilder();
            this.tabular_results = new OMG.views.TabularResults();
            // Fire for initial data now the views have registered event handlers
            this.get_packages();
            return
        }
    };

    _.extend(OMG, Backbone.Events);

    // Editor setup.
    var langTools = ace.require("ace/ext/language_tools");

    var packageCompleter = {
        getCompletions: function(editor, session, pos, prefix, callback) {
            if (prefix.length === 0 || !OMG.db.package_list) { callback(null, []); return }
            var filtered = 
            callback(null,
                     _.map(
                         _.filter(OMG.db.package_list, function(p){return p.indexOf(prefix) == 0}),
                                  function(p){
                                      return {name: p, value: p, meta: "CKAN Dataset"}
                                  }                         
                     )
                    );
        }
    }
    langTools.addCompleter(packageCompleter);
    // End editor setup
        
    OMG.get_packages = function(){
        OMG.ckan.action('current_package_list_with_resources', {}, function(err, result){
            OMG.db.package_list = result.result;
            console.log(result.result);
            OMG.trigger('package_list:reset')
        });
    };

    OMG.views.PackageListView = Backbone.View.extend({
        
        el: '.package_list',

        template: _.template($('#package_list_tpl').html()),

        events: {
            'click .dataset_title':   'toggle_dataset',
            'click .insert_resource': 'insert_resource'
        },
        
        initialize: function(opts){
            _.bindAll(this, 'render', 'toggle_dataset', 'insert_resource');
            this.render();
            OMG.on('package_list:reset', this.render);
        },
        
        render: function(){
            if(!OMG.db.package_list){
                return;
            }
            this.$el.html(this.template({packages: OMG.db.package_list}));
            return this;
        },

        toggle_dataset: function(event){
            var resources = $(event.target).next('div');
            resources.toggleClass('hidden');
        },

        insert_resource: function(event){
            var button = $(event.target);
            if(event.target.tagName == "I"){
                button = button.parent()
            }
            var dataset = _.find(OMG.db.package_list, function(p){
                return p.id == button.data('dataset-id');
            });
            var resource = _.find(dataset.resources, function(r){
                return r.id == button.data('resource-id')
            });
            // Disable this for now until we write a pre-execute parser.
            // OMG.trigger('editor:insert', dataset.name + '."' + resource.name + '"')
            OMG.trigger('editor:insert', '"' + resource.id + '"');
            return;
        }

    });

    OMG.views.QueryBuilder = Backbone.View.extend({
        
        el: '#querybuilder',

        events: {
            'click .execute': 'on_execute'
        },

        initialize: function(opts){
            _.bindAll(this, 'on_insert', 'on_execute');
            
            this.editor = ace.edit("editor");
            this.editor.setOptions({
                enableBasicAutocompletion: true,
            });
            this.editor.setTheme("ace/theme/monokai");
            this.editor.getSession().setMode("ace/mode/sql");
            this.editor.commands.addCommand({
                name: 'execute',
                bindKey: {win: 'Shift-Enter',  mac: 'Command-Enter'},
                exec: this.on_execute
            });
            this.editor.setValue('');

            OMG.on('editor:insert', this.on_insert);
        },

        on_insert: function(text){
            this.editor.insert(text);
        },

        on_execute: function(){
            OMG.ckan.datastoreSqlQuery(this.editor.getValue(), 
                                       function(err, result){
                                           if(err){
                                               alert(err.message)
                                           }
                                           OMG.db.result = result;
                                           OMG.trigger('results');
                                    });
        }
    });

    OMG.views.TabularResults = Backbone.View.extend({

        el: '#tabular_results',

        initialize: function(opts){
            _.bindAll(this, 'render');
            OMG.on('results', this.render);
        },

        render: function(){
            if(!OMG.db.result){
                return;
            }
            var model = new recline.Model.Dataset({
                fields: OMG.db.result.fields,
                records: OMG.db.result.hits
            });
            this.$el.children('.grid').css({height: '450px', width: '100%'});
            var grid = new recline.View.Grid({
                model: model,
                el: this.$el.children('.grid')
            });
            grid.visible = true;
            grid.render();
            
            return this;
        }

    });
    
})(this.window||exports, "OMG")

    // var $el = $('#mygrid');
    // console.log($el);

    // var $el = $('#mygraph');
    // var graph = new recline.View.Graph({
    //     model: dataset,
    //     state: {
    //         group: "date",
    //         series: ["x", "z"]
    //     }
    // });
    // $el.append(graph.el);
    // graph.render();
    // graph.redraw();
