sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/ui/core/ValueState",
	"sap/m/Dialog",
	"sap/m/DialogType",
	"sap/m/Button",
	"sap/m/ButtonType",
	"sap/m/Text",
	"sap/m/MessageToast",
	"sap/ui/core/routing/History"
], function (BaseController, ValueState, Dialog, DialogType, Button, ButtonType, Text, MessageToast, History) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.ToolSuite.ErrorLog.Main", {

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf view.Assistant.ErrorLog.view.Main
		 */
		onInit: function () {
			var oPopOver = this.getView().byId("idPopOver");
			oPopOver.connect(this.getView().byId("idVizFrame").getVizUid());
					
		},

		onSelectionChange: function (oEvent) {
			var sSelectedKey = oEvent.getSource().getSelectedKey();

			if (sSelectedKey === 'chart') {
				this.getView().byId("idVizFrame").setVisible(true);
				this.getView().byId("ErrorLogTable").setVisible(false);
			} else {
				this.getView().byId("idVizFrame").setVisible(false);
				this.getView().byId("ErrorLogTable").setVisible(true);
			}


		},

		filterTable: function() {
			var oTable = this.getView().byId("ErrorLogTable");

			var aFilters = [
				new sap.ui.model.Filter("ErrorStatusCode", sap.ui.model.FilterOperator.NE, "401"),
				new sap.ui.model.Filter("ErrorStatusCode", sap.ui.model.FilterOperator.NE, "403")
			];
	
			var oCombinedFilter = new sap.ui.model.Filter({
				filters: aFilters,
				and: true
			});

				//recreate binding 
				var oBindingParams = {
					path: "MCCToolSuite>/ErrorLogs",
					sorter: {
						path: 'createdAt',
						descending: true
					},
					filters: oCombinedFilter
				};
				
				// Bind the table to the model
				oTable.bindRows(oBindingParams);
	
		},

		onPressHide: function (oEvent) {
			var oTable = this.getView().byId("ErrorLogTable");

			if(oEvent.getParameter("selected")) {
				this.filterTable();
			}

			else {

				var aFilters = oTable.getBinding("rows").aFilters.filter((oFilter) => {
					return oFilter.sPath !== undefined
				});

				//recreate binding 
				var oBindingParams = {
					path: "MCCToolSuite>/ErrorLogs",
					sorter: {
						path: 'createdAt',
						descending: true
					}
					//filters: aFilters
				};
				
				oTable.bindRows(oBindingParams);

			}

			
			

		},

		onCellClick: function (oEvent) {
			var that = this;
			var iColumnIndex = parseInt(oEvent.getParameters().columnIndex, 10) + 1;
			var sColumnName = oEvent.getSource().getColumns()[iColumnIndex].getName();
			var sBindingPath = oEvent.getParameters().rowBindingContext.sPath;
			var oData = this.getView().getModel("MCCToolSuite").getProperty(sBindingPath);
			var sDialogText = oData[sColumnName];
			if (sDialogText) {
				that.showInfoDialog(this.getResourceBundle().getText(sColumnName), sDialogText);
			} else {
				MessageToast.show("The field you clicked on does not contain a value.");
			}
		},

		showInfoDialog: function (sTitle, sDialogText) {
			var sText = new Text();
			sText.setText(sDialogText);

			var oInfoMessageDialog = new Dialog({
				type: DialogType.Message,
				state: ValueState.Information,
				contentWidth: "25%",
				resizable: true,
				title: sTitle,
				content: sText,
				beginButton: new Button({
					type: ButtonType.Emphasized,
					text: "Close",
					press: function () {
						oInfoMessageDialog.close();
					}.bind(this)
				}),
				afterClose: function () {
					oInfoMessageDialog.destroy();
				}
			});

			oInfoMessageDialog.open();
		},

		invalidateApimCache: function (oEvent) {
			var that = this;

			var dialog = new Dialog({
				title: 'Confirm flushing of cache',
				type: 'Message',
				content: new Text({
					text: 'Do you really want to invalidate the API Management Cache?'
				}),
				beginButton: new Button({
					text: 'Yes',
					press: function () {

						$.ajax({
								method: "GET",
							url: sap.ui.require.toUrl("mcc/workbench/admin/settings") + "/apimcf/mcc-ops/flushCache/",
								beforeSend: function (xhr) {
									xhr.setRequestHeader("AppIdentifier", that.getAppIdentifier());
								}
							})
							.always(function (data, textStatus, jqXHR) {

								if (data.status != 200) {
									var errorText = "Response received: \n\nHTTP Status Code: " + data.status + " " + data.statusText + "\n\n" +
										"Response Text: \n" + data.responseText;
									that.showInfoDialog("Error", errorText);
								} else {
									MessageToast.show("APIM Cache successfully invalidated!");
								}

							});

						dialog.close();
					}.bind(this)
				}),
				endButton: new Button({
					text: 'No',
					press: function () {
						dialog.close();
					}.bind(this)
				}),
				afterClose: function () {
					dialog.destroy();
				}
			});

			dialog.open();
		},

		onDelete: function (oEvent) {
			var oTable = oEvent.getSource().getParent().getParent();
			var aSelectedItems = [];
			var aSelectedIndices = oTable.getSelectedIndices();
			aSelectedIndices.forEach(function (iIndex) {
				var oItem = oTable.getContextByIndex(iIndex);
				aSelectedItems.push(oItem);
			}.bind(this));
			if (aSelectedItems.length > 0) {
				var dialog = new Dialog({
					title: 'Confirm item deletion',
					type: 'Message',
					content: new Text({
						text: 'Are you sure you want to delete the selected items?'
					}),
					beginButton: new Button({
						text: 'Delete',
						press: function () {
							this._deleteSelectedItems(aSelectedItems);
							dialog.close();
						}.bind(this)
					}),
					endButton: new Button({
						text: 'Cancel',
						press: function () {
							this.getView().getModel("MCCToolSuite").resetChanges();
							dialog.close();
						}.bind(this)
					}),
					afterClose: function () {
						dialog.destroy();
					}
				});

				dialog.open();
			} else {
				MessageToast.show("No items selected...");
			}
		},

		_deleteSelectedItems: function (aSelectedItems) {
			this.getView().setBusy(true);
			aSelectedItems.forEach(function (oItem) {
				var sPath = oItem.getPath();
				this.getView().byId("ErrorLogTable").clearSelection();
				this.getView().getModel("MCCToolSuite").remove(sPath, {
					success: function () {
						this.getView().setBusy(false);
						var sText = "Removed Items";
						MessageToast.show(sText);
						this.getView().getModel("MCCToolSuite").refresh();
					}.bind(this),
					error: function (err) {
						this.getView().setBusy(false);
						var sText = "Error occurred";
						MessageToast.show(sText);
					}
				});
			}.bind(this));
		},

		formatDate: function (dateObject) {
			var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "dd.MM"
			});
			return dateFormat.format(dateObject);
		}

		/**
		 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
		 * (NOT before the first rendering! onInit() is used for that one!).
		 * @memberOf view.Assistant.ErrorLog.view.Main
		 */
		//	onBeforeRendering: function() {
		//
		//	},

		/**
		 * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
		 * This hook is the same one that SAPUI5 controls get after being rendered.
		 * @memberOf view.Assistant.ErrorLog.view.Main
		 */
		//	onAfterRendering: function() {
		//
		//	},

		/**
		 * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
		 * @memberOf view.Assistant.ErrorLog.view.Main
		 */
		//	onExit: function() {
		//
		//	}

	});

});