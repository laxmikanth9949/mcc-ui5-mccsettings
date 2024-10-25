sap.ui.getCore().loadLibrary("sapit", { url: sap.ui.require.toUrl("mcc/workbench/admin/settings") + "/resources/sapit", async: true });
sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"sap/ui/model/json/JSONModel",
	"mcc/workbench/admin/settings/model/models",
	"mcc/workbench/admin/settings/controller/ListSelector",
	"mcc/workbench/admin/settings/controller/ErrorHandler",
	"sapit/util/cFLPAdapter"
], function (UIComponent, Device, JSONModel, models, ListSelector, ErrorHandler, cFLPAdapter) {
	"use strict";

	return UIComponent.extend("mcc.workbench.admin.settings.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * In this method, the FLP and device models are set and the router is initialized.
		 * @public
		 * @override
		 */
		init: function () {
			cFLPAdapter.init();

			this.oListSelector = new ListSelector();
			this.oListSelectorWorkbenchMailTemplates = new ListSelector();
			this.oListSelectorWorkbenchFields = new ListSelector();
			this.oListSelectorWorkbenchRoadmap = new ListSelector();
			this._oErrorHandler = new ErrorHandler(this);

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
			// set the FLP model
			this.setModel(models.createFLPModel(), "FLP");
			// App Version
			this.setModel(new JSONModel({
				version: this.getMetadata().getVersion()
			}), "AppVersion");
			// set Settings Model
			this.setModel(models.createSettingsModel(), "settings");
			//set size limit of main service
			this.getModel().setSizeLimit(1000);
			// call the base component's init function and create the App view
			UIComponent.prototype.init.apply(this, arguments);

			// create the views based on the url/hash
			this.getRouter().initialize();
			this._getCFUserInfo();
			this.getCurrentUser();

			var oLocalModel = new sap.ui.model.json.JSONModel({
				"detailHeaderTitle": "",
				"averageRating": "",
				"userMessage": "",
				"gptResponseMessage": "",
				"dataID": "",
				"processedFlag": "",
				"feedbackID": "",
				"editable": false
			});
			this.setModel(oLocalModel, "local");

			this.getAveragePercentage();

		},

		getAveragePercentage: function () {
			const oModel = this.getModel("MCCAIManagerService");
			const oBinding = oModel.bindList("/AIFeedback");
			// avg rating
			oBinding.requestContexts()
				.then(aContexts => aContexts.map(oContext => oContext.getObject()))
				.then(aObjects => aObjects.map(({ rating }) => rating))
				.then(aRatings => {
					const iSum = aRatings.reduce((total, rating) => total + rating, 0);
					const iAvgRating = iSum / aRatings.length;
					let iAvgRatingPercentage = (iAvgRating / 5) * 100;
					iAvgRatingPercentage = parseFloat(iAvgRatingPercentage).toFixed(2);
					this.getModel("local").setProperty("/averageRating", iAvgRatingPercentage);
				});
		},

		/**
		 * The component is destroyed by UI5 automatically.
		 * In this method, the ListSelector and ErrorHandler are destroyed.
		 * @public
		 * @override
		 */
		destroy: function () {
			this.oListSelector.destroy();
			this.oListSelectorWorkbenchMailTemplates.destroy();
			this.oListSelectorWorkbenchRoadmap.destroy();
			this._oErrorHandler.destroy();
			this.oListSelectorWorkbenchFields.destroy();
			// call the base component's destroy function
			UIComponent.prototype.destroy.apply(this, arguments);
		},

		/**
		 * This method can be called to determine whether the sapUiSizeCompact or sapUiSizeCozy
		 * design mode class should be set, which influences the size appearance of some controls.
		 * @public
		 * @return {string} css class, either 'sapUiSizeCompact' or 'sapUiSizeCozy' - or an empty string if no css class should be set
		 */
		getContentDensityClass: function () {
			if (this._sContentDensityClass === undefined) {
				// check whether FLP has already set the content density class; do nothing in this case
				if (jQuery(document.body).hasClass("sapUiSizeCozy") || jQuery(document.body).hasClass("sapUiSizeCompact")) {
					this._sContentDensityClass = "";
				} else if (!Device.support.touch) { // apply "compact" mode if touch is not supported
					this._sContentDensityClass = "sapUiSizeCompact";
				} else {
					// "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
					this._sContentDensityClass = "sapUiSizeCozy";
				}
			}
			return this._sContentDensityClass;
		},

		getCurrentUser: function () {
			var that = this;
			jQuery.ajax({
				url: sap.ui.require.toUrl("mcc/workbench/admin/settings") + "/user-api/currentUser",
				async: false,
				method: "GET",
				dataType: 'json',
				success: function (oUserData) {
					that.getModel("settings").setProperty("/currentUserMail", oUserData.email);
					that.getModel("settings").setProperty("/currentUserID", oUserData.name);
					that.getModel("settings").setProperty("/currentUserFirstname", oUserData.firstname);
					that.getModel("settings").setProperty("/currentUserLastname", oUserData.lastname);
				}
			});
		},

		_getCFUserInfo: function () {
			this.getModel("MCCToolSuite").read("/Roles", {
				success: function (oData) {
					var aRoles = oData.results;
					aRoles.forEach(function (oItem) {
					
						if(oItem.RoleName.includes("MCCAIAdmin")) {
							this.getModel("settings").setProperty("/panelRoles/MCCAIAdmin", true);
						}
						else {
							this.getModel("settings").setProperty("/panelRoles/" + oItem.RoleName, true);
						}

					}.bind(this));
					this.getModel("settings").setProperty("/userInfoCF", oData);
				}.bind(this),
				error: function (oError) { }
			});
		}

	});

});