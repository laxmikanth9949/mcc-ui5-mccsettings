/*global location */
sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"mcc/workbench/admin/settings/model/formatter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment"
], function (BaseController, JSONModel, formatter, MessageBox, MessageToast, Fragment) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.Workbench.Roadmap.RoadmapTasks", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				lineItemListTitle: this.getResourceBundle().getText("detailPageTitleWorkbenchRoadmap")
			});

			this.getRouter().getRoute("RoadmapTasks").attachPatternMatched(this._onObjectMatched, this);
			this.setModel(oViewModel, "detailView");
			this.getOwnerComponent().getModel("AdminApp").metadataLoaded().then(this._onMetadataLoaded.bind(this));
			this._oODataModel = this.getOwnerComponent().getModel("AdminApp");
			this._oResourceBundle = this.getResourceBundle();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Updates the item count within the line item table's header
		 * @param {object} oEvent an event containing the total number of items in the list
		 * @private
		 */
		onListUpdateFinished: function (oEvent) {
			var sTitle,
				iTotalItems = oEvent.getParameter("total"),
				oViewModel = this.getModel("detailView");

			// only update the counter if the length is final
			if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
				if (iTotalItems) {
					sTitle = this.getResourceBundle().getText("detailPageTitleWorkbenchRoadmapCount", [iTotalItems]);
				} else {
					//Display 'Line Items' instead of 'Line items (0)'
					sTitle = this.getResourceBundle().getText("detailPageTitleWorkbenchRoadmap");
				}
				oViewModel.setProperty("/lineItemListTitle", sTitle);
			}
		},

		/**
		 * Event handler (attached declaratively) for the view delete button. Deletes the selected item. 
		 * @function
		 * @public
		 */
		/*	onDelete: function () {
				var that = this;
				var oViewModel = this.getModel("detailView"),
					sPath = oViewModel.getProperty("/sObjectPath"),
					sObjectHeader = this._oODataModel.getProperty(sPath + "/TemplateName"),
					sQuestion = this._oResourceBundle.getText("deleteText", sObjectHeader),
					sSuccessMessage = this._oResourceBundle.getText("deleteSuccess", sObjectHeader);

				var fnMyAfterDeleted = function () {
					MessageToast.show(sSuccessMessage);
					oViewModel.setProperty("/busy", false);
					var oNextItemToSelect = that.getOwnerComponent().oListSelectorWorkbenchMailTemplates.findNextItem(sPath);
					that.getModel("appView").setProperty("/itemToSelect", oNextItemToSelect.getBindingContext().getPath()); //save last deleted
				};
				this._confirmDeletionByUser({
					question: sQuestion
				}, [sPath], fnMyAfterDeleted);
			},*/

		/**
		 * Event handler (attached declaratively) for the view edit button. Open a view to enable the user update the selected item. 
		 * @function
		 * @public
		 */
		onEdit: function (oEvent) {
			this.getModel("appView").setProperty("/addEnabled", false);
			var sObjectPath = oEvent.getSource().getBindingContextPath(); //this.getView().getElementBinding().getPath();

			this.getRouter().getTargets().display("createRoadmapTask", {
				mode: "update",
				objectPath: sObjectPath
			});
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			var oParameter = oEvent.getParameter("arguments");
			for (var value in oParameter) {
				oParameter[value] = decodeURIComponent(oParameter[value]);
			}
			this._oODataModel.metadataLoaded().then(function () {
				var sObjectPath = this._oODataModel.createKey("Phases", oParameter);
				this._bindView("AdminApp>/" + sObjectPath);
			}.bind(this));
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function (sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function () {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		/**
		 * Event handler for binding change event
		 * @function
		 * @private
		 */

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding("AdminApp"),
				oViewModel = this.getModel("detailView"),
				oAppViewModel = this.getModel("appView");

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelectorWorkbenchRoadmap.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getBoundContext().getPath(),
				//	oResourceBundle = this.getResourceBundle(),
				oObject = this._oODataModel.getObject(sPath),
				sObjectId = oObject.ID;
			//	sObjectName = oObject.Name;

			oViewModel.setProperty("/sObjectId", sObjectId);
			oViewModel.setProperty("/sObjectPath", sPath);
			oAppViewModel.setProperty("/itemToSelect", sPath);
			this.getOwnerComponent().oListSelectorWorkbenchRoadmap.selectAListItem(sPath);
		},

		/**
		 * Event handler for metadata loaded event
		 * @function
		 * @private
		 */

		_onMetadataLoaded: function () {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
				oViewModel = this.getModel("detailView"),
				oLineItemTable = this.byId("lineItemsList"),
				iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);
			oViewModel.setProperty("/lineItemTableDelay", 0);

			oLineItemTable.attachEventOnce("updateFinished", function () {
				// Restore original busy indicator delay for line item table
				oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
			});

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
		},

		onAddTask: function (oEvent) {
			this.getModel("appView").setProperty("/addEnabled", false);

			this.getRouter().getTargets().display("createRoadmapTask", {
				mode: "create",
				objectPath: this.getView().getElementBinding("AdminApp").getPath()
			});
		}

	});
});