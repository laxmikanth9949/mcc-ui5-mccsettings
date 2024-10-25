sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"mcc/workbench/admin/settings/model/formatter",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	'sap/ui/export/Spreadsheet',
	'sap/ui/export/library',
	"sap/ui/core/mvc/Controller"
], function (BaseController, JSONModel, formatter, MessageBox, Filter, FilterOperator, Spreadsheet, exportLibrary, Controller) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList
		 */
		onInit: function () {
			this._oTable = this.byId("tagTable");
		},

		/**
		 * Fired by first action Button in the table header (edit or save)
		 * Either set the row to edit mode or save changes and switch back to view mode
		 * @memberOf mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		firstActionPressed: function (oEvent) {
			var oResourceBundle = this.getModel("i18n").getResourceBundle();
			//if: the edit button was pressed
			if (oEvent.getSource().getIcon().indexOf("edit") > -1) {
				//only allow to edit one row at a time
				if (this.oBindingContext) {
					MessageBox.error(oResourceBundle.getText("PendingChangesError"));
				} else {
					this.oBindingContext = oEvent.getParameter("row").getBindingContext("AdminApp");
					this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath())._editmode = true;
					this.oBindingContext.getModel("AdminApp").refresh(true);

					oEvent.getParameter("row").getCells()[3].addEventDelegate({
						onAfterRendering: function () {
							var oDateInner = this.$().find('.sapMInputBaseInner');
							var oID = oDateInner[0].id;
							$('#' + oID).attr("disabled", "disabled");
						}
					}, oEvent.getParameter("row").getCells()[3]);
					oEvent.getParameter("row").getCells()[4].addEventDelegate({
						onAfterRendering: function () {
							var oDateInner = this.$().find('.sapMInputBaseInner');
							var oID = oDateInner[0].id;
							$('#' + oID).attr("disabled", "disabled");
						}
					}, oEvent.getParameter("row").getCells()[4]);
				}
			}
			//else: the save button was pressed
			else {
				if (this._validateTag()) {
					this._oTable.setBusy(true);
					this._saveTag();
				} else {
					sap.m.MessageBox.error(oResourceBundle.getText("mandatoryFields"));
				}
			}
		},

		/**
		 * Fired by second action Button in the table header (delete or cancel)
		 * Either prepare the row to be deleted or cancel the edited fields and switch back to view mode
		 * @memberOf mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		secondActionPressed: function (oEvent) {
			this.oBindingContext = oEvent.getParameter("row").getBindingContext("AdminApp");

			//if: the delete button was pressed
			if (oEvent.getSource().getIcon().indexOf("delete") > -1) {
				// set the deleteID that is shown in the confirmation dialog
				var oBindingContext = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
				var sDeleteID = "with Tag Name \"" + oBindingContext.Name + "\"";

				// open the confirmation dialog
				sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("deleteText", sDeleteID), {
					icon: sap.m.MessageBox.Icon.WARNING,
					title: this.oView.getModel("i18n").getResourceBundle().getText("delete"),
					actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.OK) {
							this._deleteTag();
						} else {
							return;
						}
					}.bind(this)
				});
			}
			//else: the cancel button was pressed
			else {
				if (this.oNewEntry) {
					this.getModel("AdminApp").deleteCreatedEntry(this.oNewEntry);
					this.oNewEntry = undefined;
				}
				this.getModel("AdminApp").resetChanges();
				this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath())._editmode = false;
				this.oBindingContext.getModel("AdminApp").refresh(true);
				//reset all parameters
				this.oBindingContext = undefined;
			}
		},

		/**
		 * Fired by add button in the table header
		 * Creates a new entry and adds a row at the top of the table
		 * @memberOf mcc.workbench.admin.settings.view.SolutionHub.MCCTags.TagList
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the +  button
		 */
		onCreate: function (oEvent) {
			var oResourceBundle = this.getModel("i18n").getResourceBundle();

			//only allow to edit one row at a time
			if (this.oBindingContext) {
				MessageBox.error(oResourceBundle.getText("PendingChangesError"));
				return;
			}

			this.oNewEntry = this.getModel("AdminApp").createEntry("/MCCTags", {
				properties: {
					Name: "",
					Title: "",
					Description: "",
					DateFrom: null,
					DateTo: null,
					ShowInOneDashboard: false,
					Type: "MCC",
					_editmode: true
				}
			});
			this.oBindingContext = this.oNewEntry;
			var dialog = sap.ui.xmlfragment(this.getView().getId(),
				"mcc.workbench.admin.settings.view.SolutionHub.MCCTags.CreateTag", this);
			dialog.setBindingContext(this.oBindingContext, "AdminApp");
			this.getView().byId("dateFrom").addEventDelegate({
				onAfterRendering: function () {
					var oDateInner = this.$().find('.sapMInputBaseInner');
					var oID = oDateInner[0].id;
					$('#' + oID).attr("disabled", "disabled");
				}
			}, this.getView().byId("dateFrom"));
			this.getView().byId("dateTo").addEventDelegate({
				onAfterRendering: function () {
					var oDateInner = this.$().find('.sapMInputBaseInner');
					var oID = oDateInner[0].id;
					$('#' + oID).attr("disabled", "disabled");
				}
			}, this.getView().byId("dateTo"));
			this.oView.addDependent(dialog);
			dialog.open();
		},
		_setDateFrom: function (oEvent) {
			this.getView().getModel("AdminApp").setProperty(this.oBindingContext.getPath() + "/DateFrom", oEvent.getSource().getDateValue());
		},
		_setDateTo: function (oEvent) {
			this.getView().getModel("AdminApp").setProperty(this.oBindingContext.getPath() + "/DateTo", oEvent.getSource().getDateValue());
		},
		_onCreate: function (oEvent) {
			oEvent.getSource().getParent().setBusy(true);
			if (this._validateTag()) {
				this._saveTag();
				oEvent.getSource().getParent().close();
				oEvent.getSource().getParent().destroy();
			} else {
				sap.m.MessageBox.error(this.getModel("i18n").getResourceBundle().getText("mandatoryFields"));
				oEvent.getSource().getParent().setBusy(false);
			}
		},
		_onCancel: function (oEvent) {
			this.getModel("AdminApp").deleteCreatedEntry(this.oNewEntry);
			this.oNewEntry = undefined;
			this.getModel("AdminApp").resetChanges();
			this.oBindingContext = undefined;
			oEvent.getSource().getParent().close();
			oEvent.getSource().getParent().destroy();
		},
		/**
		 * Fired by search bar in the table header
		 * Search the term in all columns
		 * @memberOf mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList
		 * @public
		 * @param {object} oEvent The oEvent that comes with entering the search term
		 */
		onSearch: function (oEvent) {
			var searchText = oEvent.getParameter("query");

			if (searchText.trim() !== "") {
				var filter = new Filter({
					filters: [
						new Filter("Name", FilterOperator.Contains, searchText),
						new Filter("Description", FilterOperator.Contains, searchText)
					],
					and: false
				});
				this._oTable.getBinding("rows").filter(filter, sap.ui.model.FilterType.Application);
			} else {
				this._oTable.getBinding("rows").filter([], sap.ui.model.FilterType.Application);
			}
		},

		/**
		 * Fired by export button in the table header
		 * Downloads the table as excel
		 * @memberOf mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		/*	onExcelExport: function (oEvent) {
				var aCols, oRowBinding, oSettings, oSheet, oTable;
				var now = new Date();
				oTable = this._oTable;
				oRowBinding = oTable.getBinding("rows");
				aCols = this._createColumnConfig();
				var sFileName = "Solutions_" + now.toISOString() + ".xlsx";

				oSettings = {
					workbook: {
						columns: aCols,
						hierarchyLevel: 'Level'
					},
					dataSource: oRowBinding,
					fileName: sFileName,
					worker: true
				};

				oSheet = new sap.ui.export.Spreadsheet(oSettings);
				oSheet.build().finally(function () {
					oSheet.destroy();
				});
			},*/

		/**
		 * Called from onExcelExport
		 * Returns columns for excel sheet
		 * @memberOf mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList
		 * @public
		 * @returns {array} An array with all columns
		 */
		/*	_createColumnConfig: function () {
				var aCols = [];
				var oResourceBundle = this.getModel("i18n").getResourceBundle();
				var EdmType = exportLibrary.EdmType;

				aCols.push({
					label: oResourceBundle.getText("solutionArea"),
					property: "SolutionArea",
					type: EdmType.String,
					width: 15
				});
				aCols.push({
					label: oResourceBundle.getText("productID"),
					property: "ProductID",
					type: EdmType.String,
					width: 30
				});
				aCols.push({
					label: oResourceBundle.getText("productLineID"),
					property: "ProductLineID",
					type: EdmType.String,
					width: 30
				});

				return aCols;
			},*/

		/**
		 * Validate if all mandatory fields are filled in the row
		 * @memberOf mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList
		 * @private
		 */
		_validateTag: function () {
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
			var bIsOK = true;
			if ((oObject.Name === "") || (oObject.Description === "") || (oObject.Name.includes(" ")) || (oObject.DateFrom === null) || (oObject.DateTo === null)) {
				bIsOK = false;
			}
			return bIsOK;
		},

		/**
		 * Perform save requests for saving tags (newly created or existing)
		 * @memberOf mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList
		 * @private
		 */
		_saveTag: function () {
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
			delete oObject.__metadata;
			delete oObject._editmode;

			//if: existing entries
			if (oObject.TagID) {
				//submit changes in solution
				this.getModel("AdminApp").submitChanges({
					success: function () {
						this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath())._editmode = false;
						this.oBindingContext.getModel("AdminApp").refresh(true);
						this.oBindingContext = undefined;
						this.getModel("AdminApp").resetChanges();
						this._oTable.setBusy(false);
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show("Could not save tag. Please try again later.", {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						this.oBindingContext = undefined;
						this.getModel("AdminApp").resetChanges();
						this._oTable.setBusy(false);
					}.bind(this)
				});
			}
			//else: new entries
			else {
				this.getModel("AdminApp").create("/MCCTags", oObject, {
					success: function (oData) {
						this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath())._editmode = false;
						this.oBindingContext.getModel("AdminApp").refresh(true);
						this.oBindingContext = undefined;
						this.oNewEntry = undefined;
						this.getModel("AdminApp").resetChanges();
						this._oTable.setBusy(false);
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show("Could not create tag. Please try again later.", {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						this.oBindingContext = undefined;
						this.oNewEntry = undefined;
						this.getModel("AdminApp").resetChanges();
						this._oTable.setBusy(false);
					}.bind(this)
				});
			}
		},

		/**
		 * Perform delete requests for deleting existing tickets
		 * @memberOf mcc.workbench.admin.settings.controller.SolutionHub.MCCTags.TagList
		 * @private
		 */
		_deleteTag: function () {
			var sId = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()).TagID;
			var sPath = "/MCCTags(guid'" + sId + "')";
			this.getModel("AdminApp").remove(sPath, {
				success: function (oData) {
					this.oBindingContext = undefined;
				}.bind(this),
				error: function (oErr) {
					sap.m.MessageBox.show("Could not delete tag. Please try again later.", {
						icon: sap.m.MessageBox.Icon.ERROR,
						title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
						actions: [sap.m.MessageBox.Action.CLOSE]
					});
					this.oBindingContext = undefined;
					this._oTable.setBusy(false);
				}.bind(this)
			});
		}

	});

});