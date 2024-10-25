jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

// We cannot provide stable mock data out of the template.
// If you introduce mock data, by adding .json files in your webapp/localService/mockdata folder you have to provide the following minimum data:
// * At least 3 MailRoles in the list
// * All 3 MailRoles have at least one MailTemplates

sap.ui.require([
	"sap/ui/test/Opa5",
	"mcc/workbench/admin/settings/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"mcc/workbench/admin/settings/test/integration/pages/App",
	"mcc/workbench/admin/settings/test/integration/pages/Browser",
	"mcc/workbench/admin/settings/test/integration/pages/Master",
	"mcc/workbench/admin/settings/test/integration/pages/Detail",
	"mcc/workbench/admin/settings/test/integration/pages/Create",
	"mcc/workbench/admin/settings/test/integration/pages/NotFound"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "mcc.workbench.admin.settings.view."
	});

	sap.ui.require([
		"mcc/workbench/admin/settings/test/integration/MasterJourney",
		"mcc/workbench/admin/settings/test/integration/NavigationJourney",
		"mcc/workbench/admin/settings/test/integration/NotFoundJourney",
		"mcc/workbench/admin/settings/test/integration/BusyJourney",
		"mcc/workbench/admin/settings/test/integration/FLPIntegrationJourney"
	], function () {
		QUnit.start();
	});
});