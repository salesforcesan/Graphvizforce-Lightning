var soql = {

    ///// FNS USING VERSION 2 PERSISTENCE FNS I.E. VALIDATED PERSISTENCE /////
    v2: {
        /** return a list of entities present in a diagram
         *
         * @param diagram
         */
        entities: function (diagram) {
            var result = [];
            diagram.entities.forEach(function (entity) {
                result.push(entity.apiName);
            });
            return result;
        },

        /** Generate SOQL and select lists from a persisted diagram and object-wrappers
         *
         * @param diagram the validated persisted diagram JSON object
         * @param describes the ObjectWrappers for all entities, from Apex
         * @param from the driving entity for the query
         * @returns {{entities: *, selectLists: Array, selectedFields: {}}}
         */
        diagramAsSelects: function (diagram, describes, from) {

            // lookups used internally
            var describesByAPIName = {};
            var persistedEntitiesInDiagramByAPIName = {};
            var allChildRelationships = {};
            var childRelationshipsInDiagram = {};
            var parentRelationshipsInDiagram = {};

            // create a lookup for all describes
            describes.forEach(function (describe) {
                describesByAPIName[describe.apiName] = describe;
            });

            diagram.entities.forEach(function (persistedEntity) {

                var entityDescribe = describesByAPIName[persistedEntity.apiName];

                // record entities present in diagram
                persistedEntitiesInDiagramByAPIName[persistedEntity.apiName] = persistedEntity;

                // record relationships to other objects
                if (entityDescribe.childRelationships) {
                    entityDescribe.childRelationships.forEach(function (rel) {
                        if (!allChildRelationships[entityDescribe.apiName]) {
                            allChildRelationships[entityDescribe.apiName] = {};
                        }
                        allChildRelationships[entityDescribe.apiName][rel.childAPIName] = rel.relationshipName;
                    });
                }
            });

            // load the bi-directional relationship lookups (only for entities in the diagram)
            diagram.entities.forEach(function (persistedEntity) {
                var entityDescribe = describesByAPIName[persistedEntity.apiName];
                entityDescribe.fields.forEach(function (attribute) {
                    if (attribute.type == "REFERENCE") {
                        attribute.referenceFields.forEach(function (ref) { // all references fields from the describe
                            var isReferenceToAnEntityInDiagram = persistedEntitiesInDiagramByAPIName[ref.parentAPIName];
                            var isSelfReference = ref.parentAPIName == entityDescribe.apiName; // don't use self-relations in SOQL
                            if (isReferenceToAnEntityInDiagram && !isSelfReference) {
                                var relation = {
                                    field: attribute.apiName,
                                    relationshipNameFromChild: ref.relationshipName,
                                    relationshipNameToChild: allChildRelationships[ref.parentAPIName][entityDescribe.apiName],
                                    parentEntity: ref.parentAPIName,
                                    childEntity: entityDescribe.apiName,
                                };
                                // add child relations for entities in the diagram
                                if (childRelationshipsInDiagram[ref.parentAPIName]) {
                                    childRelationshipsInDiagram[ref.parentAPIName].push(relation);
                                } else { // first one seen
                                    childRelationshipsInDiagram[ref.parentAPIName] = [relation];
                                }
                                // add parent relations for entities in the diagram
                                if (parentRelationshipsInDiagram[entityDescribe.apiName]) {
                                    parentRelationshipsInDiagram[entityDescribe.apiName].push(relation);
                                } else { // first one seen
                                    parentRelationshipsInDiagram[entityDescribe.apiName] = [relation];
                                }
                            }
                        });
                    }
                });
            });

            ///// START SOQL GENERATION /////

            // arrays to be returned
            var selectLists = [];
            var selectedFields = {};

            // generate fields from the "FROM" entity
            diagram.entities.forEach(function (entity) {
                if (entity.apiName == from) {
                    var sl = soql.v2.selectList(entity);
                    if (sl.length > 0) {
                        selectLists.push(sl);
                    }
                    selectedFields[from] = soql.v2.selectedFieldsFromEntity(entity);
                }
            });

            // generate parent joins, traversing up 5 levels
            if (parentRelationshipsInDiagram[from]) {
                var ancestorPaths = soql.v2.ancestorEntityPaths(0, {}, persistedEntitiesInDiagramByAPIName[from], [], parentRelationshipsInDiagram, persistedEntitiesInDiagramByAPIName);
                var ancestorSelectLists = [];
                for (var ancestorEntity in ancestorPaths) {
                    var path = ancestorPaths[ancestorEntity];
                    var prefix = "";
                    path.forEach(function (relationshipName) {
                        if (prefix.length > 0) {
                            prefix += ".";
                        }
                        prefix += relationshipName;
                    });
                    selectedFields[ancestorEntity] = soql.v2.selectedFieldsFromEntity(persistedEntitiesInDiagramByAPIName[ancestorEntity]);
                    ancestorSelectLists.push(soql.v2.selectList(persistedEntitiesInDiagramByAPIName[ancestorEntity], prefix));
                }
                selectLists = selectLists.concat(ancestorSelectLists)
            }

            // generate child relationship joins, traversing down a single level
            if (childRelationshipsInDiagram[from]) {
                childRelationshipsInDiagram[from].forEach(function (childRelation) {
                    var selectListForChildEntity = soql.v2.selectList(persistedEntitiesInDiagramByAPIName[childRelation.childEntity]);
                    selectedFields[childRelation.childEntity] = soql.v2.selectedFieldsFromEntity(persistedEntitiesInDiagramByAPIName[childRelation.childEntity]);

                    // TODO child joins can also traverse up 5 levels from the child entity

                    var childSubQuery = "SELECT " + selectListForChildEntity + " FROM " + childRelation.relationshipNameToChild;
                    selectLists.push("(" + childSubQuery + ")");
                });
            }

            return {
                entities: soql.v2.entities(diagram),
                selectLists: selectLists,
                selectedFields: selectedFields
            };
        },

        /** return an object which has entity api names as keys and relationship paths as values e.g. "Account" -> ["Parent","Account"]
         *  This is done by traversing up to all ancestors recursively up to a max of 5 levels
         *
         * @param descendantPaths the object for all entities below this entity
         * @param entity the current entity
         * @param parentRelationshipsInDiagram an object mapping entity names to parent relationships
         * @param entitiesInDiagramByAPIName an object mapping entity names to entities
         */
        ancestorEntityPaths: function (level, descendantPaths, entity, descendentPath, parentRelationshipsInDiagram, entitiesInDiagramByAPIName) {
            if (level < 5) {
                if (parentRelationshipsInDiagram[entity.apiName]) {
                    parentRelationshipsInDiagram[entity.apiName].forEach(function (parentRelationship) {
                        var pathToParent = descendentPath.slice(0); // clone the path passed in
                        pathToParent.push(parentRelationship.relationshipNameFromChild);
                        descendantPaths[parentRelationship.parentEntity] = pathToParent;
                        // recurse up to parent here
                        soql.v2.ancestorEntityPaths(level + 1, descendantPaths, entitiesInDiagramByAPIName[parentRelationship.parentEntity], pathToParent,
                            parentRelationshipsInDiagram, entitiesInDiagramByAPIName);
                    });
                }
            }
            return descendantPaths;
        },

        selectList: function (entity, prefix) {
            var selectList = "";
            var fields = "";
            entity.fields.forEach(function (field) {
                if (fields.length > 0) {
                    fields += ",";
                }
                if (prefix) {
                    fields += prefix + ".";
                }
                fields += field.apiName;
            });
            selectList += fields;
            return selectList;
        },

        selectedFieldsFromEntity: function (entity) {
            var selected = [];
            entity.fields.forEach(function (field) {
                selected.push(field.apiName);
            });
            return selected;
        },

        diagramSelectsAsSOQL: function (selectLists, from, newlines) {
            var query = "";

            selectLists.forEach(function (fields) {
                if (query.length > 0) {
                    query += ",";
                }
                query += fields;
            });

            query += " FROM " + from;
            return "SELECT " + query;
        }
    },

    ///// FNS USING VERSION 1 PERSISTENCE FNS /////

    selectList: function (entity, prefix) {
        var selectList = "";
        var fields = "";
        entity.attributes.forEach(function (attribute) {
            if (attribute.selected) {
                if (fields.length > 0) {
                    fields += ",";
                }
                if (prefix) {
                    fields += prefix + ".";
                }
                fields += attribute.value;
            }
        });
        selectList += fields;
        return selectList;
    },

    selectedFieldsFromEntity: function (entity) {
        var selected = [];
        entity.attributes.forEach(function (attribute) {
            if (attribute.selected) {
                selected.push(attribute.value);
            }
        });
        return selected;
    },

    /** return a list of entities present in a diagram
     *
     * @param diagram
     */
    entities: function (diagram) {
        var result = [];
        diagram.groups.forEach(function (group) {
            group.entities.forEach(function (entity) {
                result.push(entity.value);
            });
        });
        return result;
    },

    diagramAsSelects: function (diagram, from) {

        // prepare some lookups to be used in the generation logic below

        var entitiesInDiagramByAPIName = {};
        var allChildRelationships = {};
        var childRelationshipsInDiagram = {};
        var parentRelationshipsInDiagram = {};

        diagram.groups[0].entities.forEach(function (entity) {
            // record entities present in diagram
            entitiesInDiagramByAPIName[entity.value] = entity;

            // record relationships to other objects
            if (entity.children) {
                entity.children.forEach(function (rel) {
                    if (!allChildRelationships[entity.value]) {
                        allChildRelationships[entity.value] = {};
                    }
                    allChildRelationships[entity.value][rel.childAPIName] = rel.relationshipName;
                });
            }
        });

        diagram.groups[0].entities.forEach(function (entity) {
            entity.attributes.forEach(function (attribute) {
                if (attribute.type == "REFERENCE") {
                    attribute.references.forEach(function (ref) {
                        var isReferenceToAnEntityInDiagram = entitiesInDiagramByAPIName[ref.parentAPIName];
                        var isSelfReference = ref.parentAPIName == entity.value;
                        if (isReferenceToAnEntityInDiagram && !isSelfReference) {
                            var relation = {
                                field: attribute.value,
                                relationshipNameFromChild: ref.relationshipName,
                                relationshipNameToChild: allChildRelationships[ref.parentAPIName][entity.value],
                                parentEntity: ref.parentAPIName,
                                childEntity: entity.value,
                            };
                            if (childRelationshipsInDiagram[ref.parentAPIName]) {
                                childRelationshipsInDiagram[ref.parentAPIName].push(relation);
                            } else {
                                childRelationshipsInDiagram[ref.parentAPIName] = [relation];
                            }
                            if (parentRelationshipsInDiagram[entity.value]) {
                                parentRelationshipsInDiagram[entity.value].push(relation);
                            } else {
                                parentRelationshipsInDiagram[entity.value] = [relation];
                            }
                        }
                    });
                }
            });
        });

        // ready for generation

        var selectLists = [];
        var selectedFields = {};

        // generate fields from the "FROM" entity
        diagram.groups[0].entities.forEach(function (entity) {
            if (entity.value == from) {
                var sl = soql.selectList(entity);
                if (sl.length > 0) {
                    selectLists.push(sl);
                }
                selectedFields[from] = soql.selectedFieldsFromEntity(entity);
            }
        });

        // generate parent joins, traversing up 5 levels
        if (parentRelationshipsInDiagram[from]) {
            var ancestorPaths = soql.ancestorEntityPaths(0, {}, entitiesInDiagramByAPIName[from], [], parentRelationshipsInDiagram, entitiesInDiagramByAPIName);
            var ancestorSelectLists = [];
            for (var ancestorEntity in ancestorPaths) {
                var path = ancestorPaths[ancestorEntity];
                var prefix = "";
                path.forEach(function (relationshipName) {
                    if (prefix.length > 0) {
                        prefix += ".";
                    }
                    prefix += relationshipName;
                });
                selectedFields[ancestorEntity] = soql.selectedFieldsFromEntity(entitiesInDiagramByAPIName[ancestorEntity]);
                ancestorSelectLists.push(soql.selectList(entitiesInDiagramByAPIName[ancestorEntity], prefix));
            }
            selectLists = selectLists.concat(ancestorSelectLists)
        }

        // generate child relationship joins, traversing down a single level
        if (childRelationshipsInDiagram[from]) {
            childRelationshipsInDiagram[from].forEach(function (childRelation) {
                var selectListForChildEntity = soql.selectList(entitiesInDiagramByAPIName[childRelation.childEntity]);
                selectedFields[childRelation.childEntity] = soql.selectedFieldsFromEntity(entitiesInDiagramByAPIName[childRelation.childEntity]);

                // TODO child joins can also traverse up 5 levels from the child entity

                var childSubQuery = "SELECT " + selectListForChildEntity + " FROM " + childRelation.relationshipNameToChild;
                selectLists.push("(" + childSubQuery + ")");
            });
        }

        return {
            entities: soql.entities(diagram),
            selectLists: selectLists,
            selectedFields: selectedFields
        };
    },

    /** return an object which has entity api names as keys and relationship paths as values e.g. "Account" -> ["Parent","Account"]
     *  This is done by traversing up to all ancestors recursively up to a max of 5 levels
     *
     * @param descendantPaths the object for all entities below this entity
     * @param entity the current entity
     * @param parentRelationshipsInDiagram an object mapping entity names to parent relationships
     * @param entitiesInDiagramByAPIName an object mapping entity names to entities
     */
    ancestorEntityPaths: function (level, descendantPaths, entity, descendentPath, parentRelationshipsInDiagram, entitiesInDiagramByAPIName) {
        if (level < 5) {
            if (parentRelationshipsInDiagram[entity.value]) {
                parentRelationshipsInDiagram[entity.value].forEach(function (parentRelationship) {
                    var pathToParent = descendentPath.slice(0); // clone the path passed in
                    pathToParent.push(parentRelationship.relationshipNameFromChild);
                    descendantPaths[parentRelationship.parentEntity] = pathToParent;
                    // recurse up to parent here
                    soql.ancestorEntityPaths(level + 1, descendantPaths, entitiesInDiagramByAPIName[parentRelationship.parentEntity], pathToParent,
                        parentRelationshipsInDiagram, entitiesInDiagramByAPIName);
                });
            }
        }
        return descendantPaths;
    },

    diagramSelectsAsSOQL: function (selectLists, from, newlines) {
        var query = "";

        selectLists.forEach(function (fields) {
            if (query.length > 0) {
                query += ",";
            }
            query += fields;
        });

        query += " FROM " + from;
        return "SELECT " + query;
    }
}

module.exports = soql;