/**
 * Created by guan on 11/12/17.
 * @description Apex controller for Lighting out app GraphVizForce
 */

public without sharing class GraphVizForceController {

    @AuraEnabled
    public static List<Graphviz_Diagram__c> loadDiagrams(){
        return [SELECT Id, Content__c FROM Graphviz_Diagram__c WHERE OwnerId = :UserInfo.getUserId()];
    }

    @AuraEnabled
    public static String loadSchema(){

        List<ObjectWrapper> objectWrappers = new List<ObjectWrapper>();
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        if(!gd.isEmpty()){
            for(Schema.SObjectType sObjType : gd.values()){

                // Describe SObject
                Schema.DescribeSObjectResult sObjResult = sObjType.getDescribe();

                // Create Object Wrapper
                ObjectWrapper objWrapper = new ObjectWrapper();
                objWrapper.label = sObjResult.getLabel();
                objWrapper.apiName = sObjResult.getName();
                objWrapper.isCustom = sObjResult.isCustom();

                // Describe Fields
                Map<String, Schema.SObjectField> fieldsMap = sObjResult.fields.getMap();
                List<Schema.SObjectField> fieldList = fieldsMap.values();
                if(!fieldList.isEmpty()){
                    objWrapper.fields = new List<FieldWrapper>();
                    for(Schema.SObjectField field : fieldList){
                        Schema.DescribeFieldResult fieldResult = field.getDescribe();
                        FieldWrapper fieldWrapper = new FieldWrapper();
                        fieldWrapper.label = fieldResult.getLabel();
                        fieldWrapper.apiName = fieldResult.getName();
                        fieldWrapper.type = fieldResult.getType().name();
                        fieldWrapper.isCustom = fieldResult.isCustom();
                        fieldWrapper.isMDOrCascadeDelete = fieldResult.isCascadeDelete();

                        // If the field is a reference field, get the list of reference field api names
                        List<Schema.sObjectType> parentSObjectTypes = fieldResult.getReferenceTo();
                        if(!parentSObjectTypes.isEmpty()){
                            fieldWrapper.referenceFields = new List<RelationshipWrapper>();
                            for(Schema.SObjectType parentSObjectType : parentSObjectTypes){
                                Schema.DescribeSObjectResult parentSObjectResult = parentSObjectType.getDescribe();
                                RelationshipWrapper rWrapper = new RelationshipWrapper();
                                rWrapper.parentLabel = parentSObjectResult.getLabel();
                                rWrapper.parentAPIName = parentSObjectResult.getName();
                                rWrapper.referenceFieldAPIName = fieldResult.getName();
                                fieldWrapper.referenceFields.add(rWrapper);
                            }
                        }

                        objWrapper.fields.add(fieldWrapper);
                    }
                }
                objectWrappers.add(objWrapper);
            }
        }

        return JSON.serialize(objectWrappers);
    }

    public class ObjectWrapper{
        public String label;
        public String apiName;
        public Boolean isCustom;
        public List<FieldWrapper> fields;
    }

    public class FieldWrapper{
        public String label;
        public String apiName;
        public String type;
        public Boolean isCustom;
        public Boolean isMDOrCascadeDelete;
        public List<RelationshipWrapper> referenceFields;
    }

    public class RelationshipWrapper{
        public String parentLabel;
        public String parentAPIName;
        public String referenceFieldAPIName;
    }
}