jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"mcc/workbench/admin/settings/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"mcc/workbench/admin/settings/test/integration/pages/App",
	"mcc/workbench/admin/settings/test/integration/pages/Browser",
	"mcc/workbench/admin/settings/test/integration/pages/Master",
	"mcc/workbench/admin/settings/test/integration/pages/Detail",
	"mcc/workbench/admin/settings/test/integration/pages/NotFound"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "mcc.workbench.admin.settings.view."
	});

	sap.ui.require([
		"mcc/workbench/admin/settings/test/integration/NavigationJourneyPhone",
		"mcc/workbench/admin/settings/test/integration/NotFoundJourneyPhone",
		"mcc/workbench/admin/settings/test/integration/BusyJourneyPhone"
	], function () {
		QUnit.start();
	});
});