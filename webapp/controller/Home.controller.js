sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device",
	"mcc/workbench/admin/settings/model/formatter"
], function (BaseController, JSONModel, Device, formatter) {
	"use strict";
	return BaseController.extend("mcc.workbench.admin.settings.controller.Home", {
		formatter: formatter,

		onInit: function () {
			Device.media.attachHandler(function (oDevice) {
				this.getModel("settings").setProperty("/isPhone", oDevice.name === "Phone");
			}.bind(this));

			this.getRouter().getRoute("home").attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function () { //table, count property, model name
			this._requestTileData("/MailRoles", "countMailRoles");
			this._requestTileData("/MailTemplatesAdminApp", "countMailTemplates");
			this._requestTileData("/ProductMapping", "countSolutions");
			this._requestTileData("/HighlightedTickets", "countQualificationDispatching", "AdminApp");
			this._requestTileData("/P1CErrorLog", "countAssistantErrorLog", "P1CTool");
			this._requestTileData("/Events", "countEvents", "SolutionHub");
			this._requestTileData("/Tasks", "countTasks", "AdminApp");
			this._requestTileData("/MCCCardLinks", "countMCCCardLinks", "AdminApp");
			this._requestTileData("/MCCTags", "countTags", "AdminApp");
			this._requestTileData("/ErrorLogs", "countToolSuiteErrorLog", "MCCToolSuite");
			this._requestTileData("/AIManagerScenario", "countScenarios", "MCCAIManagerService");
			this._requestTileData("/InformationSet", "countFAQs", "MCCAIManagerService");

		},

		onNavigationPress(oEvent) {
			const navRoutes = {
				"WorkbenchMailRolesOld": "masterWorkbenchMailRoles",
				"WorkbenchMailRoles": "MailRoles",
				"ScenarioAnalyzer": "masterScenarioAnalyzer",
				"FAQSettings": "FAQSettings",
				"WorkbenchMailTemplates": "masterWorkbenchMailTemplates",
				"Solutions": "masterSolutions",
				"QualificationDispatching": "QualificationDispatching",
				"AssistantErrorLog": "masterAssistantErrorLog",
				"ToolSuiteErrorLog": "masterToolSuiteErrorLog",
				"SolutionHubEvents": "Events",
				"AIManager": "AIManager",
				"RoadmapTasks": "RoadmapPhases",
				"MCCTags": "masterMCCTags",
				"MCCCardLinks": "MCCCardLinks",
				"WorkforcePlannerAdmin": "masterWorkforcePlanner",
				"NotificationSettings": "NotificationSettings",
				"NotificationDedicatedUsers": "NotificationDedicatedUsers",
				"DocumentStore": "DocumentStore", // special case
				"aiPlayground": "aiPlayground", // special case
			};

			const oItem = oEvent.getParameter("id");
			for (const key in navRoutes) {
				if (oItem.includes(key)) {
					if (key === "DocumentStore") {
						if (this._sEnvironment === "DEV") {
							var win = window.open("https://mcs-dev.sdmapp.cfapps.eu10.hana.ondemand.com/cp.portal/site#Shell-home");
						} else if (this._sEnvironment === "TEST") {
							 var win = window.open("https://mcs-test.sdmapp.cfapps.eu10.hana.ondemand.com/cp.portal/site#Shell-home");
						} else {
							 var win = window.open("https://mcs.sdmapp.cfapps.eu10.hana.ondemand.com/cp.portal/site#Shell-home");
						}
						win.opener = null;
						win.focus();
					} else if (key === "aiPlayground") {
						if (this._sEnvironment === "DEV") {
							var win = window.open("https://sapit-customersupport-dev-mallard.launchpad.cfapps.eu10.hana.ondemand.com/site#mccaiplayground-Display");
						} else if (this._sEnvironment === "TEST") {
							var win = window.open("https://sapit-customersupport-test-kinkajou.launchpad.cfapps.eu10.hana.ondemand.com/8b7d3ad3-0583-44cb-8477-b7ca6c3a206f.mccaiplayground.comsapmccaiplayground/index.html");
						} else {
							var win = window.open("https://sapit-customersupport-prod-kestrel.launchpad.cfapps.eu10.hana.ondemand.com/d4a97d1a-0a43-4a80-98dc-2516da1d8820.mccaiplayground.comsapmccaiplayground/index.html");
						}
						win.opener = null;
						win.focus();
					} else {	// normal case
						this.getRouter().navTo(navRoutes[key]);
					}
					break;
				}
			}
		},

		onAfterRendering: function () {
			if (window.location.href.includes("dev-mallard") || window.location.href.includes("port5000")) {
				this._sEnvironment = "DEV";
			} else if (window.location.href.includes("test-kinkajou") || window.location.href.includes("test-004")) {
				this._sEnvironment = "TEST";
			} else {
				this._sEnvironment = "PROD";
			}
			this._setPropertyToSettingsModel("environment", this._sEnvironment);
		},

		onOpenHelpPopover: function (oEvent) {
			this._oHelpBtn = oEvent.getSource();
			if (!this._oAvatarPopover) {
				this._oAvatarPopover = sap.ui.xmlfragment(this.getView().getId(), "mcc.workbench.admin.settings.view.HelpPopover", this);
				this.getView().addDependent(this._oAvatarPopover);
			}

			this._oAvatarPopover.openBy(this._oHelpBtn);
		},

		onOpenSharepointPage: function (oEvent) {
			var win = window.open("https://" + "sap.sharepoint.com/sites/202065/SitePages/MCC-Settings-App.aspx", "_blank");
			win.opener = null;
			win.focus();
		},

		onOpenTicketingApp: function (oEvent) {
			var win = window.open("https://" +
				"itsupportportal.services.sap/itsupport?id=itsm_sc_cat_item&sys_id=b1982b441bb1c1105039a6c8bb4bcbc3&sysparm_variables=%7B%22business_service%22:%2221af9c6f1ba564905039a6c8bb4bcb61%22,%22service_offering%22:%2210c283dd1b8e259036ac10e69b4bcb28%22,%22assignment_group%22:%22e5818b511b8e259036ac10e69b4bcbd4%22,%22short_description%22:%22Issue%20with%20MCC%20Settings%20App%22,%22description%22:%22Issue%20Description%20and%20steps%20to%20reproduce%20this%20issue%22%7D",
				"_blank");
			win.opener = null;
			win.focus();
		},

		onOpenUserGuide: function (oEvent) {
			var win = window.open("https://" +
				"sap.sharepoint.com/sites/202065/Shared%20Documents/MCC%20Tool%20Suite/Documentation/MCC%20Settings%20App%20Guide.pdf",
				"_blank");
			win.opener = null;
			win.focus();
		},

		_requestTileData: function (sPath, sProperty, sModelName) {
			var oModel;

			if (sModelName) {
				oModel = this.getModel(sModelName);
			} else {
				oModel = this.getModel();
			}

			if (sPath === '/MailRoles') {
				var filterCase = new sap.ui.model.Filter("caseID", sap.ui.model.FilterOperator.EQ, null);
				var filterType = new sap.ui.model.Filter({
					filters: [
						new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "G"),
						new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "P"),
						new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "PR"),
						new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "R"),
						new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "C"),
						new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "ST")
					],
					and: false
				});
				oModel.read(sPath + "/$count", {
					filters: [filterCase, filterType],
					success: this._setPropertyToSettingsModel.bind(this, sProperty)
				});
			} else if (oModel.getMetadata().getName() === "sap.ui.model.odata.v4.ODataModel") { // OData V4
				oModel.bindList(sPath).requestContexts().then(function (aContexts) {
					this.getModel("settings").setProperty("/" + sProperty, aContexts.length);
				}.bind(this));
			} else if (oModel.getMetadata().getName() === "sap.ui.model.odata.v2.ODataModel") { // OData V2
				oModel.read(sPath + '/$count', {
					success: function (count) {
						this.getModel("settings").setProperty("/" + sProperty, count);
					}.bind(this)
				});
			}
		},

		_setPropertyToSettingsModel: function (sProperty, oData) {
			this.getModel("settings").setProperty("/" + sProperty, oData);
		}

	});
});
