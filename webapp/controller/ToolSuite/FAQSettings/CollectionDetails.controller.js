sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"mcc/workbench/admin/settings/model/formatter",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, formatter, MessageToast, MessageBox) {
	"use strict";

	const splitIntoChunks = (text, chunkSize) => {
		const chunks = [];
		for (let i = 0; i < text.length; i += chunkSize) {
			chunks.push(text.slice(i, i + chunkSize));
		}
		return chunks;
	};

	return BaseController.extend("mcc.workbench.admin.settings.controller.ToolSuite.FAQSettings.CollectionDetails", {
		formatter,

		onInit: function () {
			this._oTable = this.byId("collectionDetailsTable");
			this.getRouter().getRoute("CollectionDetails").attachPatternMatched(this._onObjectMatched, this);
			this.mailUser = this.getOwnerComponent().getModel("settings").getProperty("/currentUserMail");
		},

		_onObjectMatched: function (oEvent) {
			this._sCollectionID = oEvent.getParameter("arguments").CollectionID;
			this.getCollectionDetails(this._sCollectionID);
		},

		getCollectionDetails: function (sCollectionID) {
			const oModel = new sap.ui.model.json.JSONModel();
			const oTable = this._oTable;
			this._csrfToken = null;

			sap.ui.core.BusyIndicator.show(0);

			jQuery.ajax({
				type: "GET",
				accepts: {
					json: "application/json"
				},
				url: `${sap.ui.require.toUrl("mcc/workbench/admin/settings")}/apimcf/mcc-documentgrounding/vector/api/v1/collections/${sCollectionID}/documents`,
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r",
					"X-CSRF-Token": "Fetch"
				},
				contentType: "application/json",
				async: true
			})
				.done((sData, status, jqXHR) => {
					this._csrfToken = jqXHR.getResponseHeader("X-CSRF-Token");
					const documentPromises = sData.documents.map(document => {
						document.metadata = document.metadata.reduce((obj, item) => {
							obj[item.key] = item.value[0];
							return obj;
						}, {});
						return this._fetchFirstChunk(document);
					});

					Promise.all(documentPromises).then(() => {
						oModel.setData({
							documents: sData.documents
						});

						oTable.setModel(oModel, "collectionsModel");
						sap.ui.core.BusyIndicator.hide();
					});
				})
				.fail((jqXHR) => {
					MessageBox.error(`Error ${jqXHR.responseText}`);
					sap.ui.core.BusyIndicator.hide();
				});
		},

		_fetchFirstChunk: function (document) {
			return new Promise((resolve, reject) => {
				jQuery.ajax({
					type: "GET",
					url: `${sap.ui.require.toUrl("mcc/workbench/admin/settings")}/apimcf/mcc-documentgrounding/vector/api/v1/collections/${this._sCollectionID}/documents/${document.id}`,
					headers: {
						"Content-Type": "application/json; charset=utf-8",
						"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r"
					},
					contentType: "application/json",
					async: true
				})
					.done((data) => {
						document.firstChunk = data.chunks && data.chunks.length > 0 ? data.chunks[0].content : "";
						resolve();
					})
					.fail((jqXHR) => {
						document.firstChunk = "Error fetching chunk";
						resolve();
					});
			});
		},

		_formatDateForDisplay: function (dateString) {
			var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "dd.MM.yyyy HH:mm:ss" });
			return oDateFormat.format(new Date(dateString));
		},

		_formatDateForSaving: function (date) {
			var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "yyyy-MM-ddTHH:mm:ssZ" });
			return oDateFormat.format(date);
		},

		convertDateStringForSaving: function (dateString) {
			var oDateFormatInput = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "dd.MM.yyyy HH:mm:ss" });
			var oDate = oDateFormatInput.parse(dateString);
			if (oDate) {
				var oDateFormatOutput = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "yyyy-MM-ddTHH:mm:ssZ" });
				return oDateFormatOutput.format(oDate);
			} else {
				return "N/A";
			}
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
						const sCollectionID = this._sCollectionID;
						sap.ui.core.BusyIndicator.show(0);
						jQuery.ajax({
							type: "DELETE",
							url: `${sap.ui.require.toUrl("mcc/workbench/admin/settings")}/apimcf/mcc-documentgrounding/vector/api/v1/collections/${sCollectionID}/documents/${sDeleteID}`,
							headers: {
								"Content-Type": "application/json; charset=utf-8",
								"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r",
								"X-CSRF-Token": this._csrfToken
							},
							success: () => {
								MessageToast.show("Deleted successfully");
								this.getCollectionDetails(sCollectionID);
							},
							error: (oError) => {
								MessageToast.show(`Delete operation failed: ${oError.message}`);
								sap.ui.core.BusyIndicator.hide();
							}
						});
					}
				}
			});
		},

		onNavBack: function () {
			this.getRouter().navTo("FAQSettings", {}, true);
		},

		onSave: function () {
			console.log(this._oNewContext.getObject());

			this._oNewContext.created().then(() => {
				console.log(this._oNewContext.getObject());
			}, (oError) => {
				console.error(oError);
			});
		},

		_onCancel: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		_onDelete: function (oEvent) {
			const oRowContext = oEvent.getParameter("row").getBindingContext("MCCAIManagerService");

			oRowContext.delete("$auto").then(() => {
				MessageToast.show("Deleted successfully");
			}).catch((oError) => {
				MessageToast.show(`Delete operation failed: ${oError.message}`);
			});
		},

		onCreate: function () {
			if (!this._oDialog) {
				this._oDialog = sap.ui.xmlfragment("faq-dialog", "mcc.workbench.admin.settings.view.ToolSuite.FAQSettings.CreateFAQ", this);
				this.getView().addDependent(this._oDialog);
			}

			const oDatePicker = sap.ui.core.Fragment.byId("faq-dialog", "originalCreationDate");
			oDatePicker.setDateValue(new Date());

			this._oDialog.open();
		},

		onEdit: function (oEvent) {
			const oRowContext = oEvent.getSource().getBindingContext("collectionsModel");
			if (!oRowContext) {
				MessageBox.error("Could not retrieve the binding context for the selected row.");
				return;
			}

			const oBindingObject = oRowContext.getObject();
			this._sEditDocumentID = oBindingObject.id;

			if (!this._oEditDialog) {
				this._oEditDialog = sap.ui.xmlfragment("faq-dialog-edit", "mcc.workbench.admin.settings.view.ToolSuite.FAQSettings.EditFAQ", this);
				this.getView().addDependent(this._oEditDialog);
			}

			sap.ui.core.BusyIndicator.show(0);

			jQuery.ajax({
				type: "GET",
				url: `${sap.ui.require.toUrl("mcc/workbench/admin/settings")}/apimcf/mcc-documentgrounding/vector/api/v1/collections/${this._sCollectionID}/documents/${this._sEditDocumentID}`,
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r"
				},
				contentType: "application/json",
				async: true
			})
				.done((data) => {
					this._oEditDialog.setBindingContext(oRowContext, "collectionsModel");

					sap.ui.core.Fragment.byId("faq-dialog-edit", "Title").setValue(oBindingObject.metadata.title);

					const concatenatedInformation = data.chunks.map(chunk => chunk.content).join("");
					sap.ui.core.Fragment.byId("faq-dialog-edit", "Information").setValue(concatenatedInformation);

					sap.ui.core.Fragment.byId("faq-dialog-edit", "sourceLink").setValue(oBindingObject.metadata.webUrl);
					sap.ui.core.Fragment.byId("faq-dialog-edit", "originalCreationDate").setValue(oBindingObject.metadata.timestamp);

					// Set the original createdAt and createdBy values without modifying them
					sap.ui.core.Fragment.byId("faq-dialog-edit", "createdBy").setText(oBindingObject.metadata.createdBy || "N/A");
					sap.ui.core.Fragment.byId("faq-dialog-edit", "createdAt").setText(
						this._formatDateForDisplay(oBindingObject.metadata.createdAt)
					);

					// Set the current modifiedBy and modifiedAt values
					sap.ui.core.Fragment.byId("faq-dialog-edit", "modifiedBy").setText(oBindingObject.metadata.modifiedBy);
					sap.ui.core.Fragment.byId("faq-dialog-edit", "modifiedAt").setText(
						this._formatDateForDisplay(oBindingObject.metadata.modifiedAt)
					);

					sap.ui.core.BusyIndicator.hide();
					this._oEditDialog.open();
				})
				.fail((jqXHR) => {
					MessageBox.error(`Error fetching document details: ${jqXHR.responseText}`);
					sap.ui.core.BusyIndicator.hide();
				});
		},

		_onSaveEdit: function () {
			const oDialog = this._oEditDialog;
			const sTitle = sap.ui.core.Fragment.byId("faq-dialog-edit", "Title").getValue();
			const sInformation = sap.ui.core.Fragment.byId("faq-dialog-edit", "Information").getValue();
			const sSource = sap.ui.core.Fragment.byId("faq-dialog-edit", "sourceLink").getValue();
			const oDate = sap.ui.core.Fragment.byId("faq-dialog-edit", "originalCreationDate").getValue();

			const oCreatedBy = sap.ui.core.Fragment.byId("faq-dialog-edit", "createdBy").getText();
			const oCreatedAt = sap.ui.core.Fragment.byId("faq-dialog-edit", "createdAt").getText();

			const sModifiedAt = new Date();
			const sModifiedAtFormatted = this._formatDateForSaving(sModifiedAt);

			const sCreatedAtFormatted = this.convertDateStringForSaving(oCreatedAt);

			if (!sSource.startsWith("https://")) {
				sap.ui.core.Fragment.byId("faq-dialog-edit", "sourceLink").setValueState("Error");
				sap.ui.core.Fragment.byId("faq-dialog-edit", "sourceLink").setValueStateText("The URL must start with 'https://'");
				return;
			} else {
				sap.ui.core.Fragment.byId("faq-dialog-edit", "sourceLink").setValueState("None");
			}

			oDialog.close();
			sap.ui.core.BusyIndicator.show(0);

			const anonymizeData = (inputText, callback) => {
				const apiURL = "/apimcf/mcc-aimanager/odata/v4/MCCAIManager/anonymize";
				const modelID = "2bc5f4b8-c1ed-4dea-9647-4643de2b7630";

				const requestBody = {
					"Body": {
						"modelID": modelID,
						"input": inputText,
						"whitelist": ""
					}
				};

				jQuery.ajax({
					type: "POST",
					url: `${sap.ui.require.toUrl("mcc/workbench/admin/settings")}/apimcf/mcc-aimanager/odata/v4/MCCAIManager/anonymize`,
					data: JSON.stringify(requestBody),
					contentType: "application/json; charset=utf-8",
					headers: {
						"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r",
						"X-CSRF-Token": this._csrfToken
					},
					success: (data) => {
						if (data && data.responseText) {
							callback(null, data.responseText);
							this.getCollectionDetails(this._sCollectionID);
						} else {
							callback(new Error('Unexpected API response structure'));
						}
					},
					error: (oError) => {
						callback(new Error(`Anonymization API request failed: ${oError.responseText || oError.statusText}`));
					}
				});
			};

			anonymizeData(sInformation, (err, anonymizedInformation) => {
				if (err) {
					MessageBox.error(err.message);
					sap.ui.core.BusyIndicator.hide();
					return;
				}

				const metadataList = [{
					key: "id",
					value: [this._sEditDocumentID]
				},
				{
					key: "title",
					value: [sTitle]
				},
				{
					key: "timestamp",
					value: [oDate]
				},
				{
					key: "webUrl",
					value: [sSource]
				},
				{
					key: "createdBy",
					value: [oCreatedBy || "N/A"]
				},
				{
					key: "createdAt",
					value: [sCreatedAtFormatted || "N/A"]
				},
				{
					key: "modifiedBy",
					value: [this.mailUser || "N/A"]
				},
				{
					key: "modifiedAt",
					value: [sModifiedAtFormatted || "N/A"]
				}];

				const chunks = splitIntoChunks(anonymizedInformation, 200).map((chunk, index) => ({
					content: chunk,
					metadata: [{
						key: "id",
						value: [globalThis.crypto.randomUUID()]
					},
					{
						key: "webUrl",
						value: [sSource || ""]
					},
					{
						key: 'startIndex',
						value: [(index * 200).toString()]
					},
					{
						key: "chunkRange",
						value: [(index * 200) + "-" + ((index + 1) * 200)].toString()
					}]
				}));

				const jsonObject = {
					documents: [{
						id: this._sEditDocumentID,
						metadata: metadataList,
						chunks
					}]
				};

				const jsonString = JSON.stringify(jsonObject, null, 2);

				jQuery.ajax({
					type: "PATCH",
					data: jsonString,
					accepts: {
						json: "application/json"
					},
					url: `${sap.ui.require.toUrl("mcc/workbench/admin/settings")}/apimcf/mcc-documentgrounding/vector/api/v1/collections/${this._sCollectionID}/documents`,
					headers: {
						"Content-Type": "application/json; charset=utf-8",
						"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r",
						"X-CSRF-Token": this._csrfToken
					},
					contentType: "application/json",
					async: true
				})
					.done(() => {
						this.getCollectionDetails(this._sCollectionID);
					})
					.fail((jqXHR) => {
						MessageBox.error(`Error ${jqXHR.responseText}`);
						sap.ui.core.BusyIndicator.hide();
					});
			});
		},

		_onCreate: function () {
			const oDialog = this._oDialog;
			const sTitle = sap.ui.core.Fragment.byId("faq-dialog", "Title").getValue();
			const sInformation = sap.ui.core.Fragment.byId("faq-dialog", "Information").getValue();
			const sSource = sap.ui.core.Fragment.byId("faq-dialog", "sourceLink").getValue();
			const oDate = sap.ui.core.Fragment.byId("faq-dialog", "originalCreationDate").getValue();
			const sID = globalThis.crypto.randomUUID();

			const sCreatedAt = new Date();
			const sCreatedAtFormatted = this._formatDateForSaving(sCreatedAt);
			const sModifiedAtFormatted = sCreatedAtFormatted;

			if (!sSource.startsWith("https://")) {
				sap.ui.core.Fragment.byId("faq-dialog", "sourceLink").setValueState("Error");
				sap.ui.core.Fragment.byId("faq-dialog", "sourceLink").setValueStateText("The URL must start with 'https://'");
				return;
			} else {
				sap.ui.core.Fragment.byId("faq-dialog", "sourceLink").setValueState("None");
			}

			oDialog.close();
			oDialog.destroy();
			this._oDialog = null;
			sap.ui.core.BusyIndicator.show(0);

			const anonymizeData = (inputText, callback) => {
				const apiURL = "/apimcf/mcc-aimanager/odata/v4/MCCAIManager/anonymize";
				const modelID = "2bc5f4b8-c1ed-4dea-9647-4643de2b7630";

				const requestBody = {
					"Body": {
						"modelID": modelID,
						"input": inputText,
						"whitelist": ""
					}
				};

				jQuery.ajax({
					type: "POST",
					url: `${sap.ui.require.toUrl("mcc/workbench/admin/settings")}/apimcf/mcc-aimanager/odata/v4/MCCAIManager/anonymize`,
					data: JSON.stringify(requestBody),
					contentType: "application/json; charset=utf-8",
					headers: {
						"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r",
						"X-CSRF-Token": this._csrfToken
					},
					success: (data) => {
						if (data && data.responseText) {
							callback(null, data.responseText);
						} else {
							callback(new Error('Unexpected API response structure'));
						}
					},
					error: (oError) => {
						callback(new Error(`Anonymization API request failed: ${oError.responseText || oError.statusText}`));
					}
				});
			};

			anonymizeData(sInformation, (err, anonymizedInformation) => {
				if (err) {
					MessageBox.error(err.message);
					sap.ui.core.BusyIndicator.hide();
					return;
				}

				const metadataList = [{
					key: "id",
					value: [sID]
				},
				{
					key: "title",
					value: [sTitle]
				},
				{
					key: "timestamp",
					value: [oDate]
				},
				{
					key: "webUrl",
					value: [sSource]
				},
				{
					key: "createdBy",
					value: [this.mailUser]
				},
				{
					key: "createdAt",
					value: [sCreatedAtFormatted]
				},
				{
					key: "modifiedBy",
					value: [this.mailUser]
				},
				{
					key: "modifiedAt",
					value: [sModifiedAtFormatted]
				}];

				const chunks = splitIntoChunks(anonymizedInformation, 200).map((chunk, index) => ({
					content: chunk,
					metadata: [{
						key: "id",
						value: [globalThis.crypto.randomUUID()]
					},
					{
						key: "webUrl",
						value: [sSource]
					},
					{
						key: 'startIndex',
						value: [(index * 200).toString()]
					},
					{
						key: "chunkRange",
						value: [(index * 200) + "-" + ((index + 1) * 200)].toString()
					}]
				}));

				const jsonObject = {
					documents: [{
						id: sID,
						metadata: metadataList,
						chunks
					}]
				};

				const jsonString = JSON.stringify(jsonObject, null, 2);

				jQuery.ajax({
					type: "POST",
					data: jsonString,
					url: `${sap.ui.require.toUrl("mcc/workbench/admin/settings")}/apimcf/mcc-documentgrounding/vector/api/v1/collections/${this._sCollectionID}/documents`,
					headers: {
						"Content-Type": "application/json; charset=utf-8",
						"AppIdentifier": "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r",
						"X-CSRF-Token": this._csrfToken
					},
					contentType: "application/json",
					async: true
				})
					.done(() => {
						this.getCollectionDetails(this._sCollectionID);
						sap.ui.core.BusyIndicator.hide();
					})
					.fail((jqXHR) => {
						MessageBox.error(`Error ${jqXHR.responseText}`);
						sap.ui.core.BusyIndicator.hide();
					});
			});
		}
	});
});