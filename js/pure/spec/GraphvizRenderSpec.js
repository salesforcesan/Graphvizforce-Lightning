var gvfp = require('../src/pure.js');
var samples = require('../test/diagramPersistedSamples.js');
var views = require('../test/diagramViewSamples.js');
var fs = require('fs');
var Validator = require('jsonschema').Validator;

var renderAndValidate = function (sampleName, variation, opts) {// get the persistence and render the view shape
    var translated = gvfp.graphviz.diagramAsMustacheView(samples[sampleName], opts);
    fs.mkdir("./generated");
    fs.writeFileSync("./generated/" + sampleName + "-" + variation + ".gv", gvfp.graphviz.diagramAsText(translated));
    var v = new Validator();
    return {
        translated: translated,
        validation: v.validate(translated, views.schema)
    }
};

describe("persisted samples are translated into valid view data", function () {
    describe("contact, account, feed, case", function () {
        describe("simple i.e. no options in use", function () {
            var rendered = renderAndValidate("account_contact_feed_case", "basic", {showSelfRelations: false});
            it("valid translation", function () {
                expect(rendered.validation.errors).toEqual([]);
            })
            it("translation returns 2 Account fields", function () {
                expect(rendered.translated.groups[0].entities[0].fields)
                    .toEqual([{
                            name: 'Account Description',
                            id: 'Description',
                            type: 'TEXTAREA'
                        },
                            {
                                name: 'Account Source',
                                id: 'AccountSource',
                                type: 'PICKLIST'
                            }]
                    );
            })
        });
        // if a SOQL from change event uses Account then ContactFeed is a grandchild and not included in the SOQL
        describe("entity obscured", function () {
            var rendered = renderAndValidate("account_contact_feed_case", "obscuring", {obscureEntities: ["ContactFeed"]});
            it("valid translation", function () {
                expect(rendered.validation.errors).toEqual([]);
            })
            it("Account entity is not obscured", function () {
                expect(rendered.translated.groups[0].entities[0].color).toEqual(gvfp.graphviz.entityFocused);
            })
            it("ContactFeed entity is obscured", function () {
                expect(rendered.translated.groups[0].entities[3].color).toEqual(gvfp.graphviz.entityObscured);
            })
        });
    });

    describe("contact, account, case simple", function () {
        var rendered = renderAndValidate("account_contact_case", "basic", {showSelfRelations: false});
        it("valid translation", function () {
            expect(rendered.validation.errors).toEqual([]);
        })
        it("translation returns 2 Account fields", function () {
            expect(rendered.translated.groups[0].entities[0].fields)
                .toEqual([{
                        name: 'Account Description',
                        id: 'Description',
                        type: 'TEXTAREA'
                    },
                        {
                            name: 'Account Source',
                            id: 'AccountSource',
                            type: 'PICKLIST'
                        }]
                );
        })
    });

    describe("contact, account, case with self", function () {
        var rendered = renderAndValidate("account_contact_case", "with-self", {showSelfRelations: true});
        it("valid translation", function () {
            expect(rendered.validation.errors).toEqual([]);
        })
        it("translation returns 4 Account fields sorted by name", function () {
            expect(rendered.translated.groups[0].entities[0].fields)
                .toEqual([
                    {
                        name: 'Account Description',
                        id: 'Description',
                        type: 'TEXTAREA'
                    },
                    {
                        name: 'Account Source',
                        id: 'AccountSource',
                        type: 'PICKLIST'
                    },
                    {
                        name: 'Master Record ID',
                        id: 'MasterRecordId',
                        type: 'REFERENCE'
                    },
                    {
                        name: 'Parent Account ID',
                        id: 'ParentId',
                        type: 'REFERENCE'
                    }]);
        })
    });

    describe("Custom objects with master detail relationship", function () {
        var rendered = renderAndValidate("master_detail_relationships", "with-basic", {showSelfRelations: false});
        it("valid translation", function () {
            expect(rendered.validation.errors).toEqual([]);
        })
        it("relationships would use solid line if it is master detail relation", function () {
            expect(rendered.translated.relationships[1])
                .toEqual({ from: 'MasterObject__c',
                    to: 'DetailObject__c',
                    field: 'DetailObject__c',
                    style: 'solid' });
        })
    });
})

describe("view data validation", function () {
    var v = new Validator();
    var validationResult = v.validate(views.samples.account_contact, views.schema);
    it("sample view is valid",
        function () {
            expect(validationResult.errors).toEqual([]);
        })
})


// use the files generated below for instant feedback when changing the template. Graphviz will auto-refresh.
describe("rendering view samples to graphviz artifacts", function () {
    var result = gvfp.graphviz.diagramAsText(views.samples.account_contact);
    //console.log(result);
    fs.mkdir("./generated");
    fs.writeFileSync("./generated/canonical_account_contact.gv", result);
})


