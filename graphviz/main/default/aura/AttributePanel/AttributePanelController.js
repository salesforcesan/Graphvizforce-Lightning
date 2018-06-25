({
    handleObjectChange : function(component, event, helper) {
        var object = component.get('v.object');
        var availableAttributes = [];
        var selectedAttributes = [];
        object.attributes.forEach(function(attribute){
            attribute.visible = true;
            if(attribute.selected){
                selectedAttributes.push(attribute);
            }
            else{
                availableAttributes.push(attribute);
            }
        });
		
        availableAttributes.sort(GraphvizForce.DiagramHelper.compare);
        selectedAttributes.sort(GraphvizForce.DiagramHelper.compare);
		        
		component.set('v.availableAttributes', availableAttributes);
		component.set('v.selectedAttributes', selectedAttributes);
        helper.handleFilterAvailable(component, event, helper);
        helper.handleFilterSelected(component, event, helper);
	},
    
	onAddClicked : function(component, event, helper) {
        var attribute = event.getParam('scope');
        attribute.selected = true;
        component.getEvent('onObjectAttributesUpdated').setParams({scope:attribute}).fire();
        if(window.showUserGuide) $A.get("e.gvf2:UserGuideEvent").setParams({scope:'step5'}).fire();
	},
    
    onRemoveClicked : function(component, event, helper) {
        var attribute = event.getParam('scope');
        attribute.selected = false;
        component.getEvent('onObjectAttributesUpdated').setParams({scope:attribute}).fire();
        if(window.showUserGuide) $A.get("e.gvf2:UserGuideEvent").setParams({scope:'step5'}).fire();
	},
    
    onSearchAvailable : function(component, event, helper) {
        helper.handleFilterAvailable(component, event, helper);
    },
    
    onSearchSelected : function(component, event, helper) {
        helper.handleFilterSelected(component, event, helper);
    },
    
    onAttributeClicked : function(component, event, helper) {
		event.stopPropagation();
    },

    handleUserGuideEvent : function(component, event, helper){
        var step = event.getParam('scope');
        component.set('v.showHelp4', step === 'step4' && window.showUserGuide);
    },
})