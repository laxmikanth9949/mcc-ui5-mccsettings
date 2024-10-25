sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"mcc/workbench/admin/settings/model/formatter",
	"sap/m/MessageToast",
	'sap/f/library',
	'sap/m/MessageBox'
], function (BaseController, formatter, MessageToast, fioriLibrary, MessageBox) {
	"use strict";

	var isCreating = false;
	return BaseController.extend("mcc.workbench.admin.settings.controller.ToolSuite.AIManager.AIManager", {
		formatter,

		onInit() {
			this._oTable = this.byId("scenarioTable");
			this._oLocalModel = this.getOwnerComponent().getModel("local");

			const url = `${sap.ui.require.toUrl("mcc/workbench/admin/settings")}/apimcf/mcc-aimanager/odata/v4/MCCAIManager/evaluateCIM()`;

			jQuery.ajax({
				url: url,
				async: false,
				method: "GET",
				dataType: 'json',
				success: function (oData) {
					console.log(oData);
				}.bind(this),
				error: function (err) {
					console.error('There was a problem with the AJAX request:', err.status, err.statusText);
				}
			});
		},

		onNavigate(oEvent) {
			if (isCreating) {
				this._resetCreatingStatus();
			}

			const oRowContext = oEvent.getSource().getBindingContext("MCCAIManagerService");
			const oData = oRowContext.getObject();
			const sScenarioId = oData.ID.toString();
			this._oLocalModel.setProperty("/editable", false);

			const oFCL = this.oView.getParent().getParent();
			oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
			oFCL.getAggregation("midColumnPages")[0].bindElement({
				path: `/AIManagerScenario(${sScenarioId})`,
				model: "MCCAIManagerService",
			});
		},

		secondActionPressed(oEvent) {
			this.oBindingContext = oEvent.getParameter("row").getBindingContext("MCCAIManagerService");

			const oButton = oEvent.getSource();

			const row = oEvent.getParameter("row");
			const parameters = row.getCells()[1];
			const description = row.getCells()[2];

			if (oButton.getIcon().includes("delete")) {
				const oBindingContext = this.oBindingContext.getObject();
				const sDeleteID = `with Scenario ID "${oBindingContext.ID}"`;

				MessageBox.show(
					this.oView.getModel("i18n").getResourceBundle().getText("deleteText", sDeleteID),
					{
						icon: MessageBox.Icon.WARNING,
						title: this.oView.getModel("i18n").getResourceBundle().getText("delete"),
						actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
						onClose: oAction => {
							if (oAction === MessageBox.Action.OK) {
								this.oBindingContext.delete("$auto")
									.then(() => {
										MessageToast.show("Deleted successfully");
										this._refreshScenarioList();
									})
									.catch(oError => MessageToast.show(`Delete operation failed: ${oError.message}`));
							}
						}
					}
				);
			} else {
				this._oLocalModel.setProperty("/editable", false);
				oButton.setIcon("sap-icon://delete");

				parameters.setValue(globalParameters);
				description.setValue(globalDescription);
			}
		},

		handleClose() {
			if (isCreating) {
				this._resetCreatingStatus();
			}

			const oFCL = this.oView.getParent().getParent();
			oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);
			this._oLocalModel.setProperty("/editable", false);
		},

		handleEdit() {
			this._oLocalModel.setProperty("/editable", true);
		},

		async handleSave() {
			const oView = this.getView();
			const oModel = oView.getModel("MCCAIManagerService");
			let oBindingContext;

			if (isCreating) {
				// Creating a new entry
				const defaultParameters = JSON.stringify({
					messages: [{ content: oView.byId("InputPrompt").getValue() }],
					maxTokens: oView.byId("SliderTokens").getValue(),
					temperature: oView.byId("SliderTemperature").getValue(),
					frequencyPenalty: oView.byId("SliderFrequencyPenalty").getValue(),
					presencePenalty: oView.byId("SliderPresencePenalty").getValue()
				});

				try {
					const oListBinding = oModel.bindList("/AIManagerScenario");
					const oNewEntryContext = await oListBinding.create({
						Description: oView.byId("detailHeaderInput").getValue(),
						Parameters: defaultParameters
					}).created();

					oBindingContext = oNewEntryContext;
					MessageToast.show("New entry created successfully");
					isCreating = false;
					oModel.refresh();
				} catch (error) {
					MessageToast.show(`Creation failed: ${error.message}`);
				}
			} else {
				// Updating an existing entry
				oBindingContext = oView.getBindingContext("MCCAIManagerService");

				let jsonParameters;
				try {
					const oPropertyParameters = oBindingContext.getProperty("Parameters");
					jsonParameters = JSON.parse(oPropertyParameters);
				} catch (error) {
					console.error("Error parsing property parameters:", error);
					jsonParameters = {
						messages: [{ content: "" }],
						maxTokens: 0,
						temperature: 0,
						frequencyPenalty: 0,
						presencePenalty: 0
					};
				}

				const updatedParameters = {
					messages: [{ content: oView.byId("InputPrompt").getValue() }],
					maxTokens: oView.byId("SliderTokens").getValue(),
					temperature: oView.byId("SliderTemperature").getValue(),
					frequencyPenalty: oView.byId("SliderFrequencyPenalty").getValue(),
					presencePenalty: oView.byId("SliderPresencePenalty").getValue()
				};

				Object.assign(jsonParameters, updatedParameters);
				oBindingContext.setProperty("Parameters", JSON.stringify(jsonParameters));
				oBindingContext.setProperty("Description", oView.byId("detailHeaderInput").getValue());

				MessageToast.show("Changes saved successfully");
			}

			if (oModel.hasPendingChanges()) {
				try {
					await oModel.submitBatch("$auto");
					MessageToast.show("Changes saved successfully");
				} catch (oError) {
					MessageToast.show(`Save operation failed: ${oError.message}`);
				}
			}

			this._oLocalModel.setProperty("/editable", false);
			this._refreshScenarioList();

			const detailHeader = oView.byId("detailHeader");
			const detailHeaderInput = oView.byId("detailHeaderInput").getValue();
			detailHeader.setText(detailHeaderInput);
		},

		handleDelete() {
			const oView = this.getView();
			const oModel = oView.getModel("MCCAIManagerService");
			const oBindingContext = oView.getBindingContext("MCCAIManagerService");

			if (!oBindingContext) {
				MessageToast.show("No entry is currently selected for deletion.");
				return;
			}

			const oData = oBindingContext.getObject();
			const sDeleteID = `with Scenario ID "${oData.ID}"`;

			MessageBox.show(
				this.oView.getModel("i18n").getResourceBundle().getText("deleteText", sDeleteID),
				{
					icon: MessageBox.Icon.WARNING,
					title: this.oView.getModel("i18n").getResourceBundle().getText("delete"),
					actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
					onClose: oAction => {
						if (oAction === MessageBox.Action.OK) {
							oBindingContext.delete("$auto")
								.then(() => {
									MessageToast.show("Deleted successfully");
									const oFCL = oView.getParent().getParent();
									oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);
									oModel.refresh();
								})
								.catch(oError => MessageToast.show(`Delete operation failed: ${oError.message}`));
						}
					}
				}
			);

		},

		onCreate() {
			if (!isCreating) {
				isCreating = true;
				this._oLocalModel.setProperty("/editable", true);

				const oView = this.getView();
				const oFCL = oView.getParent().getParent();
				const oDetailView = oFCL.getAggregation("midColumnPages")[0];

				this._clearDetailViewFields(oDetailView);
				oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
			}
		},

		_resetCreatingStatus() {
			isCreating = false;
			this._oLocalModel.setProperty("/editable", false);

			const oView = this.getView();
			this._clearDetailViewFields(oView);
		},

		_clearDetailViewFields(oDetailView) {
			try {
				oDetailView.byId("detailHeaderInput").setValue("");
				oDetailView.byId("InputPrompt").setValue("");
				oDetailView.byId("SliderTokens").setValue(0);
				oDetailView.byId("SliderTemperature").setValue(0);
				oDetailView.byId("SliderFrequencyPenalty").setValue(0);
				oDetailView.byId("SliderPresencePenalty").setValue(0);
			} catch (error) {
				console.error("Error clearing detail view fields:", error);
			}
		},

		_refreshScenarioList() {
			const oScenarioTable = this.byId("scenarioTable");
			const oBinding = oScenarioTable.getBinding("rows");
			oBinding.refresh();
		}
	});
});