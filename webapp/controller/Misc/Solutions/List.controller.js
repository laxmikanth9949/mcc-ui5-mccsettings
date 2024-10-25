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

	return BaseController.extend("mcc.workbench.admin.settings.controller.Misc.Solutions.List", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 */
		onInit: function () {
			this._oTable = this.byId("table");

			this.getView().setModel(new sap.ui.model.json.JSONModel({
				title: this.getResourceBundle().getText("solutionsCount", [0])
			}), "masterView");
		},

		/**
		 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
		 * (NOT before the first rendering! onInit() is used for that one!).
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 */
		onBeforeRendering: function () {
			this._readSolutions();
		},

		/**
		 * Fired by first action Button in the table header (edit or save)
		 * Either set the row to edit mode or save changes and switch back to view mode
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
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
					this.oBindingContext = oEvent.getParameter("row").getBindingContext("ProductMapping");
					this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath())._editmode = true;
					this.oBindingContext.getModel().refresh(true);
				}
			}
			//else: the save button was pressed
			else {
				if (this._validateSolution()) {
					this._oTable.setBusy(true);
					this._saveSolution();
				} else {
					sap.m.MessageBox.error(oResourceBundle.getText("mandatoryFields"));
				}

			}
		},

		/**
		 * Fired by second action Button in the table header (delete or cancel)
		 * Either prepare the row to be deleted or cancel the edited fields and switch back to view mode
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		secondActionPressed: function (oEvent) {
			this.oBindingContext = oEvent.getParameter("row").getBindingContext("ProductMapping");

			//if: the delete button was pressed
			if (oEvent.getSource().getIcon().indexOf("delete") > -1) {
				// set the deleteID that is shown in the confirmation dialog
				var sDeleteID = "";
				var oBindingContext = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath());
				if (oBindingContext.ProductID) {
					sDeleteID = sDeleteID.concat("with Product ID \"", oBindingContext.ProductID, "\"");
				} else if (oBindingContext.ProductLineID) {
					sDeleteID = sDeleteID.concat("with Product Line ID \"", oBindingContext.ProductLineID, "\"");
				} else if (oBindingContext.SolutionArea) {
					sDeleteID = sDeleteID.concat("with Solution Area \"", oBindingContext.SolutionArea, "\"");
				}
				
				// open the confirmation dialog
				sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("deleteText", sDeleteID), {
					icon: sap.m.MessageBox.Icon.WARNING,
					title: this.oView.getModel("i18n").getResourceBundle().getText("delete"),
					actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.OK) {
							this._oTable.setBusy(true);
							this._deleteSolution();
						} else {
							return;
						}
					}.bind(this)
				});
			}
			//else: the cancel button was pressed
			else {
				if (this.oNewEntry) {
					this.getModel().deleteCreatedEntry(this.oNewEntry);
					this.oNewEntry = undefined;
				}
				this.getModel().resetChanges();
				this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath())._editmode = false;
				this._readSolutions();
				this.oBindingContext.getModel().refresh(true);
				//reset all parameters
				this.oBindingContext = undefined;
			}
		},

		/**
		 * Fired by add button in the table header
		 * Creates a new entry and adds a row at the top of the table
		 * @memberOf mcc.workbench.admin.settings.view.List
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

			this.oNewEntry = this.getModel().createEntry("/ProductMapping", {
				properties: {
					SolutionArea: "",
					ProductID: "",
					ProductLineID: "",
					_editmode: true
				}
			});
			this.oBindingContext = this.oNewEntry;
			this.getModel("ProductMapping").getData().push(this.getModel().getProperty(this.oNewEntry.getPath()));
			this.getModel("ProductMapping").refresh(true);

			//Reset sorter, that new entry is always on top
			this._oTable.getBinding("rows").sort(new sap.ui.model.Sorter("SolutionArea", false));
			this._oTable.getBinding("rows").refresh(true);

			//Update table title
			var sTitle = this.getResourceBundle().getText("solutionsCount", [this.getModel("ProductMapping").getData().length]);
			this.getModel("masterView").setProperty("/title", sTitle);
		},

		/**
		 * Fired by search bar in the table header
		 * Search the term in all columns
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with entering the search term
		 */
		onSearch: function (oEvent) {
			var searchText = oEvent.getParameter("query");

			if (searchText.trim() !== "") {
				var filter = new Filter({
					filters: [
						new Filter("SolutionArea", FilterOperator.Contains, searchText),
						new Filter("ProductID", FilterOperator.Contains, searchText),
						new Filter("ProductLineID", FilterOperator.Contains, searchText)
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
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		onExcelExport: function (oEvent) {
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
		},

		/**
		 * Called from onExcelExport
		 * Returns columns for excel sheet
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 * @public
		 * @returns {array} An array with all columns
		 */
		_createColumnConfig: function () {
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
		},

		/**
		 * Read highlighted tickets and store them in own model
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 * @private
		 */
		_readSolutions: function () {
			this.getView().getModel().read("/ProductMapping", {
				success: function (oData) {
					if (!this.getModel("ProductMapping")) {
						var oModel = new JSONModel([]);
						oModel.attachPropertyChange(function (oEvent) {
							var oContext = oEvent.getParameter("context");
							var oObject = oContext.getModel().getProperty(oContext.getPath());
							var sProperty = oEvent.getParameter("path");
							var sPath = "";
							//if: existing entries
							if (oObject.ID) {
								sPath = "/ProductMapping(guid'" + oObject.ID + "')";
							}
							//else: new entries
							else {
								sPath = oContext.getModel().getProperty(oContext.getPath()).__metadata.deepPath;
							}

							this.getModel().setProperty(sPath + "/" + sProperty, oEvent.getParameter("value"));
						}.bind(this));
						this.getView().setModel(oModel, "ProductMapping");
					}

					for (var i = 0; i < oData.results.length; i++) {
						oData.results[i]._editmode = false;
					}
					this.getModel("ProductMapping").setData(oData.results);
					this.getModel("ProductMapping").refresh();

					//Update table title
					var sTitle = this.getResourceBundle().getText("solutionsCount", oData.results.length);
					this.getModel("masterView").setProperty("/title", sTitle);
					this.getModel("masterView").refresh(true);
					
					this._oTable.setBusy(false);
				}.bind(this),
				error: function (oErr) {
					console.log("Could not load ProductMapping. Reason: " + oErr);
				}
			});
		},

		/**
		 * Validate if all mandatory fields are filled in the row
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 * @private
		 */
		_validateSolution: function () {
			var oObject = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath());
			var bIsOK = true;
			if ((oObject.SolutionArea === "") || ((oObject.ProductID === "") && (oObject.ProductLineID === ""))) {
				bIsOK = false;
			}
			return bIsOK;
		},

		/**
		 * Perform save requests for saving tickets (newly created or existing)
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 * @private
		 */
		_saveSolution: function () {
			var oObject = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath());
			delete oObject.__metadata;
			delete oObject._editmode;

			//if: existing entries
			if (oObject.ID) {
				//submit changes in solution
				this.getModel().submitChanges({
					success: function () {
						this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath())._editmode = false;
						this.oBindingContext.getModel().refresh(true);
						this.oBindingContext = undefined;
						this.getModel().resetChanges();
						this._oTable.setBusy(false);
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("saveSolutionError"), {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						this.oBindingContext = undefined;
						this.getModel().resetChanges();
						this._oTable.setBusy(false);
					}.bind(this)
				});
			}
			//else: new entries
			else {
				this.getModel().create("/ProductMapping", oObject, {
					success: function (oData) {
						this._readSolutions();
						this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath())._editmode = false;
						this.oBindingContext.getModel().refresh(true);
						this.oBindingContext = undefined;
						this.oNewEntry = undefined;
						this.getModel().resetChanges();
						this._oTable.setBusy(false);
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("createSolutionError"), {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						this.oBindingContext = undefined;
						this.oNewEntry = undefined;
						this.getModel().resetChanges();
						this._oTable.setBusy(false);
					}.bind(this)
				});
			}
		},

		/**
		 * Perform delete requests for deleting existing tickets
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 * @private
		 */
		_deleteSolution: function () {
			var sId = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath()).ID;
			var sPath = "/ProductMapping(guid'" + sId + "')";
			this.getModel().remove(sPath, {
				success: function (oData) {
					this.oBindingContext = undefined;
					this._readSolutions();
				}.bind(this),
				error: function (oErr) {
					sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("deleteSolutionError"), {
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