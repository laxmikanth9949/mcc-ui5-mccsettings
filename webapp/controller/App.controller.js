sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"mcc/workbench/admin/settings/model/formatter"
], function (BaseController, JSONModel, Formatter) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.App", {

		onInit: function () {
			var oViewModel,
				fnSetAppNotBusy,
				oListSelector = this.getOwnerComponent().oListSelector,
				iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();

			oViewModel = new JSONModel({
				busy: true,
				delay: 0,
				itemToSelect: null,
				addEnabled: false

			});
			this.setModel(oViewModel, "appView");

			fnSetAppNotBusy = function () {
				oViewModel.setProperty("/busy", false);
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			};

			this.getOwnerComponent().getModel().metadataLoaded()
				.then(fnSetAppNotBusy);

			// Makes sure that master view is hidden in split app
			// after a new list entry has been selected.
			oListSelector.attachListSelectionChange(function () {
				this.byId("idAppControl").hideMaster();
			}, this);

			// apply content density mode to root view
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
			this.initValueHelpModel();
		},

		initValueHelpModel: function () {
			var oValueHelp = {
				TOorCC: Formatter.getTOORCC(),
				RoleTypes: Formatter.getRoleTypes(),
				Regions: Formatter.getRegions(),
				Subregions: Formatter.getSubregions(),
				Subsubregions: Formatter.getSubsubregions(),
				Subsubsubregions: Formatter.getSubsubsubregions(),
				TemplateTypes: Formatter.getTemplateTypes()
			};
			this.getOwnerComponent().setModel(new JSONModel(oValueHelp), "oValueHelp");
		}
	});

});