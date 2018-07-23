/**
 * Created by guan on 9/12/17.
 */
({
    handleObjectListUpdate : function(component, event, helper){
        var filteredObjects = [];
        var currentState = component.get('v.currentState');
        var term = component.get('v.searchTerm');
        GraphvizForce.allObjects.forEach(function(object){
            var searchTermExist = term !== undefined && term !== '';
            var searchMatch = (searchTermExist && (object.label.toLowerCase().indexOf(term.toLowerCase()) !== -1 || object.apiName.toLowerCase().indexOf(term.toLowerCase()) !== -1));
            var isSelected = (GraphvizForce.selectionMap[object.apiName] != null);
            if((currentState == 'ALL' && (!searchTermExist || searchMatch)) || (currentState == 'SEARCH' && searchMatch) || (currentState == 'SELECTED' && isSelected)){
                var uiObject = {label:object.label, apiName:object.apiName, selected:isSelected};
                filteredObjects.push(uiObject);
            }
        });
        filteredObjects.sort(GraphvizForce.DiagramHelper.compare);
        component.set('v.filteredObjects', filteredObjects);
    },
})