({
    /**
    * Sets current state and calculate filtered object list when current state is SEARCH
    */
    onSearchState : function(component, event, helper) {
        component.set('v.currentState', 'SEARCH');
        component.find("inputSearch").focus();
        helper.handleObjectListUpdate(component, event, helper);
    },

    /**
    * Sets current state and calculate filtered object list when current state is ALL
    */
    onAllState : function(component, event, helper) {
        component.set('v.currentState', 'ALL');
        component.set('v.searchTerm', '');
        component.find("inputSearch").focus();
        helper.handleObjectListUpdate(component, event, helper);
    },

    /**
    * Sets current state and calculate filtered object list when current state is SELECTED
    */
    onSelectedState : function(component, event, helper) {
        component.set('v.currentState', 'SELECTED');
        component.set('v.searchTerm', '');
        component.find("inputSearch").focus();
        helper.handleObjectListUpdate(component, event, helper);
    },

    /**
    * Calculate filtered object list with debounce behaviour when user type in search box
    */
    onUpdateSearchTerm : function(component, event, helper){
        var searchObjectDebounce = component.get('v.searchObjectDebounce');
        if(searchObjectDebounce == null){
            searchObjectDebounce = Core.SystemUtils.debounce(function() {
                // All the taxing stuff you do
                helper.handleObjectListUpdate(component, event, helper);
            }, 1000);
        }
        searchObjectDebounce();
    },

    /**
    * App event DiagramUpdatedEvent (type:SELECTION) handler
    */
    onDiagramUpdated : function(component, event, helper){
        if(event.getParam('type') == 'SELECTION'){
            component.set('v.searchTerm', '');
            var diagram = component.get('v.diagram');
            var isSelectedObjects = !$A.util.isEmpty(diagram.entities);
            component.set('v.currentState', isSelectedObjects ? 'SELECTED' : 'SEARCH');
            component.find("inputSearch").focus();
            helper.handleObjectListUpdate(component, event, helper);
        }
    },
})