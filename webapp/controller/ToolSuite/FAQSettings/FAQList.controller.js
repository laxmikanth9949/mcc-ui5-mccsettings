sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"mcc/workbench/admin/settings/model/formatter",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (BaseController, formatter, MessageToast, MessageBox, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.ToolSuite.FAQSettings.FAQList", {
		formatter: formatter,

		onInit: function () {
			this._oTable = this.byId("faqTable");
			this.getCollections();
		},

		getCollections: function () {
			var oModel = new sap.ui.model.json.JSONModel();
			var oTable = this._oTable;
			var that = this;
			jQuery.ajax({
				type: "GET",
				accepts: {
					json: "application/json"
				},
				url: sap.ui.require.toUrl("mcc/workbench/admin/settings") + "/apimcf/mcc-documentgrounding/vector/api/v1/collections",
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r"
				},
				contentType: "application/json",
				async: true
			})
				.done(function (sData) {
					oModel.setData({
						collections: sData.collections
					});
					oTable.setModel(oModel, "collectionsModel");

					that.applyFilter();
				})
				.fail(function (jqXHR, exception, exx) {
					MessageBox.error("Error " + jqXHR.responseText);
				});
		},

		applyFilter: function () {
			var oTable = this.byId("faqTable");
			var oBinding = oTable.getBinding("rows");
			var aFilters = [
				new Filter("title", FilterOperator.NE, "scenarios")
			];
			oBinding.filter(aFilters);
		},

		onDelete: function (oEvent) {
			const oRowContext = oEvent.getParameter("row").getBindingContext("collectionsModel");
			if (!oRowContext) {
				MessageBox.error("Could not retrieve the binding context for the selected row.");
				return;
			}

			const oBindingObject = oRowContext.getObject();
			const sDeleteID = oBindingObject.id;

			MessageBox.show(
				this.oView.getModel("i18n").getResourceBundle().getText("deleteText", [sDeleteID]), {
				icon: MessageBox.Icon.WARNING,
				title: this.oView.getModel("i18n").getResourceBundle().getText("delete"),
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				onClose: (oAction) => {
					if (oAction === MessageBox.Action.OK) {
						jQuery.ajax({
							type: "GET",
							url: sap.ui.require.toUrl("mcc/workbench/admin/settings") + "/apimcf/mcc-documentgrounding/vector/api/v1/collections/" + sDeleteID,
							headers: {
								"Content-Type": "application/json; charset=utf-8",
								"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r",
								"X-CSRF-Token": "Fetch"
							},
							success: (data, status, xhr) => {
								const csrfToken = xhr.getResponseHeader("X-CSRF-Token");
								jQuery.ajax({
									type: "DELETE",
									url: sap.ui.require.toUrl("mcc/workbench/admin/settings") + "/apimcf/mcc-documentgrounding/vector/api/v1/collections/" + sDeleteID,
									headers: {
										"Content-Type": "application/json; charset=utf-8",
										"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r",
										"X-CSRF-Token": csrfToken
									},
									success: () => {
										MessageToast.show("Deleted successfully");
										this.getCollections();
									},
									error: (oError) => {
										MessageToast.show("Delete operation failed: " + oError.message);
									}
								});
							},
							error: (oError) => {
								MessageToast.show("Failed to retrieve CSRF token: " + oError.message);
							}
						});
					}
				}
			});
		},

		onNavigate: function (oEvent) {
			var oRowContext = oEvent.getSource().getBindingContext("collectionsModel");
			if (!oRowContext) {
				sap.m.MessageBox.error("No row context available for the selected row.");
				return;
			}

			var sPath = oRowContext.getPath();
			this.getRouter().navTo("CollectionDetails", {
				CollectionID: this._oTable.getModel("collectionsModel").getProperty(sPath).id
			}, true);
		},

		onSave: function () {
			console.log(this._oNewContext.getObject());

			this._oNewContext.created().then(function () {
				console.log(this._oNewContext.getObject());
			}.bind(this), function (oError) {
				console.error(oError);
			}.bind(this));
		},

		_onCancel: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		_onDelete: function (oEvent) {
			var oRowContext = oEvent.getParameter("row").getBindingContext("MCCAIManagerService");

			oRowContext.delete("$auto").then(function () {
				MessageToast.show("Deleted successfully");
			}).catch(function (oError) {
				MessageToast.show("Delete operation failed: " + oError.message);
			});
		},

		_onCreate: function () {
			var oDialog = this._oDialog;
			var oModel = this.getView().getModel("MCCAIManagerService");

			var sQuestion = sap.ui.core.Fragment.byId("faq-dialog", "Title").getValue();
			var sAnswer = sap.ui.core.Fragment.byId("faq-dialog", "Information").getValue();
			var sSource = sap.ui.core.Fragment.byId("faq-dialog", "sourceLink").getValue();
			var oDate = sap.ui.core.Fragment.byId("faq-dialog", "originalCreationDate").getValue();

			var oListBinding = oModel.bindList("/InformationSet");
			var oContext = oListBinding.create({
				"title": sQuestion,
				"information": sAnswer,
				"sourceLink": sSource,
				"originalCreationDate": new Date(oDate)
			});

			oDialog.setBindingContext(oContext);

			oModel.submitBatch("AIManagerBatchGroup").then(() => {
				MessageToast.show("Created successfully");
				oDialog.destroy();

				this.getCollectionDetails(this._sCollectionID);

			}).catch(function (oError) {
				MessageToast.show("There was an Error while creating");
				console.log(oError);
				oDialog.destroy();
			}.bind(this));
		}
	});
});