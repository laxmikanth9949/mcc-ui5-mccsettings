/*
 * Controller for the Events list view
 * @public
 * @namespace mcc.workbench.admin.settings.view.List
 */
sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"mcc/workbench/admin/settings/model/formatter",
	"mcc/workbench/admin/settings/const/Constants",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	'sap/ui/export/Spreadsheet',
	'sap/ui/export/library',
	"sap/ui/core/Fragment",
	"sap/m/MessageToast"
], function (BaseController, JSONModel, formatter, Constants, MessageBox, Filter, FilterOperator, Spreadsheet, exportLibrary, Fragment,
	MessageToast) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.SolutionHub.Events.EventList", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf mcc.workbench.admin.settings.view.List
		 */
		onInit: function () {
			// Control state model
			this._oODataModel = this.getOwnerComponent().getModel("SolutionHub");
			this.getOwnerComponent().setModel(new JSONModel([]), "contacts");
			this._oODataModel.attachEventOnce("batchRequestCompleted", function (oEvent) {
				var aPaths = Object.entries(oEvent.getSource().mPathCache),
					aPromises = [],
					aContactNames = [];
				aPaths.forEach(function (path) {
					var contacts = oEvent.getSource().getData(path[0]).Contacts,
						aUserId = contacts.split(",");
					if (contacts !== null && contacts !== "" && !window.location.href.includes("webidetesting")) {
						aUserId.forEach(function (userID) {
							var bLoaded = aContactNames.filter(aContactNames => aContactNames.includes(userID)).length > 0;
							if (userID && userID !== "restricted_data" && !bLoaded) {
								aPromises.push(new Promise(function (resolve, reject) {
									jQuery.ajax({
										url: sap.ui.require.toUrl("mcc/workbench/admin/settings") + "/sapit-employee-data/Employees('" + userID + "')",
										async: false,
										method: "GET",
										dataType: "json",
										success: function (oUserData) {
											aContactNames.push(oUserData.firstName + " " + oUserData.lastName + " (" + oUserData.ID + ")");
											resolve();
										},
										error: function (err) {
											resolve();
										}
									});
								}));
							}
						});
					}
				}.bind(this));
				Promise.all(aPromises).then(function () {
					this.getOwnerComponent().getModel("contacts").setData(aContactNames);
				}.bind(this));
			}.bind(this));
			this._oResourceBundle = this.getResourceBundle();
		},

		onNavigate: function (oEvent) {
			this.getModel("appView").setProperty("/addEnabled", false);
			var sObjectPath = oEvent.getSource().getBindingContext("SolutionHub").getPath();
			this.getRouter().getTargets().display("createSolutionHubEvents", {
				mode: "update",
				objectPath: sObjectPath
			});
		},
		onSelectRow: function (oEvent) {
			var items = this.getView().byId("EventListTable").getSelectedIndices();
			if (items.length === 1) this.getView().byId("copyEvent").setEnabled(true);
			else this.getView().byId("copyEvent").setEnabled(false);
			if (items.length > 0) {
				this.getView().byId("deleteEvents").setEnabled(true);
				this.getView().byId("publishEvents").setEnabled(true);
			} else {
				this.getView().byId("deleteEvents").setEnabled(false);
				this.getView().byId("publishEvents").setEnabled(false);
			}
		},

		/**
		 * Event handler  (attached declaratively) called when the add button in the master view is pressed. it opens the create view.
		 * @public
		 */
		onCreate: function () {
			this.getView().unbindObject();
			this.getModel("appView").setProperty("/addEnabled", false);
			this.getModel("appView").setProperty("/mode", "create");
			this.getModel("appView").setProperty("/enableCreate", true);
			this.getRouter().getTargets().display("createSolutionHubEvents");

		},
		onCreateCopy: function (oEvent) {
			var items = this.getView().byId("EventListTable").getSelectedIndices();
			var sObjectPath = this.getView().byId("EventListTable").getBindingInfo("rows").binding.aKeys[items[0]];
			this.getView().unbindObject();
			this.getModel("appView").setProperty("/addEnabled", false);
			this.getModel("appView").setProperty("/mode", "create");
			this.getModel("appView").setProperty("/enableCreate", true);
			this.getRouter().getTargets().display("createSolutionHubEvents", {
				mode: "copy",
				objectPath: "/" + sObjectPath
			});
		},
		onDelete: function (oEvent) {
			var oTable = oEvent.getSource().getParent().getParent();
			var aSelectedItems = [];
			var aSelectedIndices = oTable.getSelectedIndices();
			aSelectedIndices.forEach(function (iIndex) {
				var oItem = oTable.getContextByIndex(iIndex);
				aSelectedItems.push(oItem);
			});
			if (aSelectedItems.length > 0) {
				var dialog = new sap.m.Dialog({
					title: "Confirmation",
					type: "Message",
					content: new sap.m.Text({
						text: "Are you sure you want to delete the selected items?"
					}),
					beginButton: new sap.m.Button({
						text: "Delete",
						press: function () {
							this._deleteSelectedItems(aSelectedItems);
							dialog.close();
						}.bind(this)
					}),
					endButton: new sap.m.Button({
						text: "Cancel",
						press: function () {
							this.getView().getModel("SolutionHub").resetChanges();
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
			this.getView().byId("EventListTable").clearSelection();
			aSelectedItems.forEach(function (oItem) {
				var sPath = oItem.getPath();
				this.getView().getModel("SolutionHub").remove(sPath, {
					success: function () {
						this.getView().setBusy(false);
						var sText = "The selected items have been removed.";
						MessageToast.show(sText);
						this.getView().getModel("SolutionHub").refresh();
					}.bind(this),
					error: function (err) {
						this.getView().setBusy(false);
						var sText = "Error occurred while deleting items.";
						MessageToast.show(sText);
					}.bind(this)
				});
			}.bind(this));
		},

		onPublish: function (oEvent) {
			var oTable = this.getView().byId("EventListTable");
			var aSelectedItems = [];
			var aSelectedIndices = oTable.getSelectedIndices();
			aSelectedIndices.forEach(function (iIndex) {
				var oItem = oTable.getContextByIndex(iIndex);
				aSelectedItems.push(oItem);
			});
			if (aSelectedItems.length > 0) {
				var dialog = new sap.m.Dialog({
					title: "Confirmation",
					type: "Message",
					content: new sap.m.Text({
						text: "The status of all selected items will be changed to 'Published'.\nThey will be visible for everyone in the MCC Solution Hub Event Calendar."
					}),
					beginButton: new sap.m.Button({
						text: "Publish",
						press: function () {
							this._publishSelectedItems(aSelectedItems);
							dialog.close();
						}.bind(this)
					}),
					endButton: new sap.m.Button({
						text: "Cancel",
						press: function () {
							dialog.close();
						}
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
		_publishSelectedItems: function (aSelectedItems) {
			this.getView().setBusy(true);
			aSelectedItems.forEach(function (oItem) {
				var sPath = oItem.getPath();
				this.getView().getModel("SolutionHub").update(sPath, {
					Status: "Published"
				}, {
					success: function () {
						this.getView().setBusy(false);
						var sText = "The selected items have been published.";
						MessageToast.show(sText);
						this.getView().getModel("SolutionHub").refresh();
					}.bind(this),
					error: function (err) {
						this.getView().setBusy(false);
						var sText = "Error occurred while changing the status.";
						MessageToast.show(sText);
					}.bind(this)
				});
			}.bind(this));
			this.getView().byId("EventListTable").clearSelection();
		},

		onSortContacts: function (oEvent) {
			var bDesc = oEvent.getSource().getText().includes("Descending");
			var oSorter = new sap.ui.model.Sorter("Contacts", bDesc, false);
			this.getView().byId("EventListTable").getBinding("rows").sort(oSorter, "Control");
			oEvent.getSource().getParent().getParent().setSorted(true);
		},

		onFilterContacts: function (oEvent) {
			var oValue = oEvent.getSource().getValue().trim();
			var filter, aFilter = [];
			if (oValue) {
				var contacts = this.getOwnerComponent().getModel("contacts").getData();
				contacts.forEach(function (user) {
					if (user.includes(oValue)) {
						var userId = user.substring(user.indexOf("(") + 1, user.indexOf(")") - 1);
						aFilter.push(new Filter("Contacts", "Contains", userId));
					}
				});
			}
			if (aFilter.length > 0) {
				filter = new Filter({
					filters: aFilter,
					and: false
				});
				oEvent.getSource().getParent().getParent().setFiltered(true);
			} else if (!oValue) {
				filter = [];
				oEvent.getSource().getParent().getParent().setFiltered(false);
			} else if (oValue && aFilter.length === 0) {
				filter = new Filter("Contacts", "Contains", oValue);
				oEvent.getSource().getParent().getParent().setFiltered(true);
			}
			// Apply filter
			this.getView().byId("EventListTable").getBinding("rows").filter(filter, "Control");
		},
		onFilterMyEvents: function () {
			var filter = new Filter("createdBy", "EQ", this.getModel("settings").getProperty("/currentUserID"));
			this.getView().byId("EventListTable").getBinding("rows").filter(filter, "Control");
			this.getView().byId("myEvents").setVisible(false);
			this.getView().byId("allEvents").setVisible(true);
		},
		onFilterAllEvents: function () {
			this.getView().byId("EventListTable").getBinding("rows").filter([], "Control");
			this.getView().byId("myEvents").setVisible(true);
			this.getView().byId("allEvents").setVisible(false);
		}
	});
});