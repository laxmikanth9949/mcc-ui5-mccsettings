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

	return BaseController.extend("mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 */
		onInit: function () {
			this._oTable = this.byId("table");

			this.getView().setModel(new sap.ui.model.json.JSONModel({
				title: this.getResourceBundle().getText("handlingNotesCount", [0])
			}), "masterView");
		},

		onProfileChange: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			var sKey = oSelectedItem.getKey();
			var oContext = oEvent.getSource().getBindingContext("HighlightedTickets");
			oContext.getModel().setProperty(oContext.getPath() + "/Type", sKey);
		},

		/**
		 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
		 * (NOT before the first rendering! onInit() is used for that one!).
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 */
		onBeforeRendering: function () {
			this._readTickets();
		},

		/**
		 * Fired by first action Button in the table header (edit or save)
		 * Either set the row to edit mode or save changes and switch back to view mode
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
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
					this.oBindingContext = oEvent.getParameter("row").getBindingContext("HighlightedTickets");
					this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath())._editmode = true;
					this.oBindingContext.getModel().refresh(true);
				}
			}
			//else: the save button was pressed
			else {
				if (this._validateTicket()) {
					this._oTable.setBusy(true);
					this._saveTicket();
				} else {
					sap.m.MessageBox.error(oResourceBundle.getText("mandatoryFields"));
				}

			}
		},

		/**
		 * Fired by second action Button in the table header (delete or cancel)
		 * Either prepare the row to be deleted or cancel the edited fields and switch back to view mode
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		secondActionPressed: function (oEvent) {
			this.oBindingContext = oEvent.getParameter("row").getBindingContext("HighlightedTickets");

			//if: the delete button was pressed
			if (oEvent.getSource().getIcon().indexOf("delete") > -1) {
				// Opens the confirmation dialog
				sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("deleteTicket"), {
					icon: sap.m.MessageBox.Icon.WARNING,
					title: this.oView.getModel("i18n").getResourceBundle().getText("delete"),
					actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.OK) {
							this._oTable.setBusy(true);
							this._deleteTicket();
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
				this.getModel("AdminApp").mChangedEntities = {};
				this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath())._editmode = false;
				this._readTickets();
				this.oBindingContext.getModel().refresh(true);
				//reset all parameters
				this.aToBeCreated = [];
				this.aToBeDeleted = [];
				this._toCC = undefined;
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

			this.oNewEntry = this.getModel("AdminApp").createEntry("/HighlightedTickets", {
				properties: {
					Message: "",
					Icon: "",
					Property: "",
					FilterOperator: "",
					FilterValue: "",
					ValidFrom: null,
					ValidTo: null,
					Type: "",
					_editmode: true
				}
			});
			this.oBindingContext = this.oNewEntry;
			this.getModel("HighlightedTickets").getData().push(this.getModel("AdminApp").getProperty(this.oNewEntry.getPath()));
			this.getModel("HighlightedTickets").refresh(true);

			//Reset sorter, that new entry is always on top
			this._oTable.getBinding("rows").sort(new sap.ui.model.Sorter("Message", false));
			this._oTable.getBinding("rows").refresh(true);

			//Update table title
			var sTitle = this.getResourceBundle().getText("handlingNotesCount", [this.getModel("HighlightedTickets").getData().length]);
			this.getModel("masterView").setProperty("/title", sTitle);
		},

		/**
		 * Fired by search bar in the table header
		 * Search the term in all columns
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with entering the search term
		 */
		onSearch: function (oEvent) {
			var searchText = oEvent.getParameter("query");

			if (searchText.trim() !== "") {
				var filter = new Filter({
					filters: [
						new Filter("Message", FilterOperator.Contains, searchText),
						new Filter("Icon", FilterOperator.Contains, searchText),
						new Filter("Property", FilterOperator.Contains, searchText),
						new Filter("FilterValue", FilterOperator.Contains, searchText)
					],
					and: false
				});
				if ("EQUALS".indexOf(searchText.toUpperCase()) > -1) {
					filter.aFilters.push(new sap.ui.model.Filter("FilterOperator", sap.ui.model.FilterOperator.EQ, "EQ"));
				}
				if ("CONTAINS".indexOf(searchText.toUpperCase()) > -1) {
					filter.aFilters.push(new sap.ui.model.Filter("FilterOperator", sap.ui.model.FilterOperator.EQ, "CONTAINS"));
				}
				if (Date.parse(searchText) > 0) {
					var oStart = new Date(Date.parse(searchText));
					var oEnd = new Date(Date.parse(searchText));
					oEnd.setHours(23);
					oEnd.setMinutes(59);
					oEnd.setSeconds(59);
					filter.aFilters.push(new sap.ui.model.Filter("ValidFrom", sap.ui.model.FilterOperator.BT, oStart, oEnd));
					filter.aFilters.push(new sap.ui.model.Filter("ValidTo", sap.ui.model.FilterOperator.BT, oStart, oEnd));
				}

				this._oTable.getBinding("rows").filter(filter, sap.ui.model.FilterType.Application);
			} else {
				this._oTable.getBinding("rows").filter([], sap.ui.model.FilterType.Application);
			}
		},

		/**
		 * Fired by column sort menu of dates
		 * Sort function for dates column
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the menu button
		 */
		onSort: function (oEvent) {
			var oColumn = oEvent.getSource().getParent().getParent();
			var sProperty = oColumn.getProperty("sortProperty");
			var bIsDesc = oEvent.getSource().getIcon().indexOf("desc") > -1;
			//remove sorted icon on all other columns
			if (sProperty === "ValidTo") {
				for (var i = 0; i < 6; i++) {
					oColumn.getParent().getColumns()[i].setSorted(false);
				}
			} else {
				for (var i = 0; i < 5; i++) {
					oColumn.getParent().getColumns()[i].setSorted(false);
				}
				oColumn.getParent().getColumns()[6].setSorted(false);
			}
			oColumn.setSorted(true);
			this._oTable.getBinding("rows").sort(new sap.ui.model.Sorter(sProperty, bIsDesc));
			this._oTable.getBinding("rows").refresh(true);
		},

		/**
		 * Fired by column filter menu of dates
		 * Filter function for dates column as the values are stored in the value help
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with entering the search term
		 */
		onFilter: function (oEvent) {
			var sValue = oEvent.getParameter("item").getProperty("value");
			var sProp = oEvent.getSource().getParent().getParent().getProperty("filterProperty");
			var aTableFilters = this._oTable.getBinding("rows").aFilters;
			var aClearedTableFilters = [];
			var aFilter = [];
			var aNewFilter = [];

			for (var j = 0; j < aTableFilters.length; j++) {
				if (aTableFilters[j].sPath !== sProp) {
					aClearedTableFilters.push(aTableFilters[j]);
				}
			}

			if (sValue.trim() !== "" && Date.parse(sValue) > 0) {
				oEvent.getSource().getParent().getParent().setFiltered(true);
				var oStart = new Date(Date.parse(sValue));
				var oEnd = new Date(Date.parse(sValue));
				oEnd.setHours(23);
				oEnd.setMinutes(59);
				oEnd.setSeconds(59);
				if (aFilter.length === 0) {
					aFilter.push(new sap.ui.model.Filter(sProp, sap.ui.model.FilterOperator.BT, oStart, oEnd));
				}
				aNewFilter = aClearedTableFilters.concat(aFilter);
			} else {
				oEvent.getSource().getParent().getParent().setFiltered(false);
				aNewFilter = aClearedTableFilters;
			}

			this._oTable.getBinding("rows").filter(aNewFilter);
			this._oTable.getBinding("rows").refresh(true);
		},

		/**
		 * Fired by export button in the table header
		 * Downloads the table as excel
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		onExcelExport: function (oEvent) {
			var aCols, oRowBinding, oSettings, oSheet, oTable;
			var now = new Date();
			oTable = this._oTable;
			oRowBinding = oTable.getBinding("rows");
			aCols = this._createColumnConfig();
			var sFileName = "Handling_Notes_" + now.toISOString() + ".xlsx";

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
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @public
		 * @returns {array} An array with all columns
		 */
		_createColumnConfig: function () {
			var aCols = [];
			var oResourceBundle = this.getModel("i18n").getResourceBundle();
			var EdmType = exportLibrary.EdmType;

			aCols.push({
				label: oResourceBundle.getText("message"),
				property: "Message",
				type: EdmType.String,
				width: 60
			});
			aCols.push({
				label: oResourceBundle.getText("icon"),
				property: "Icon",
				type: EdmType.String,
				width: 20
			});
			aCols.push({
				label: oResourceBundle.getText("property"),
				property: "Property",
				type: EdmType.String,
				width: 20
			});
			aCols.push({
				label: oResourceBundle.getText("filterOperator"),
				property: "FilterOperator",
				type: EdmType.String,
				width: 10
			});
			aCols.push({
				label: oResourceBundle.getText("filterValue"),
				property: "FilterValue",
				type: EdmType.String,
				width: 10
			});
			aCols.push({
				label: oResourceBundle.getText("validFrom"),
				property: "ValidFrom",
				type: EdmType.Date
			});
			aCols.push({
				label: oResourceBundle.getText("validTo"),
				property: "ValidTo",
				type: EdmType.Date
			});
			aCols.push({
				label: oResourceBundle.getText("profile"),
				property: "Type",
				type: EdmType.String,
				width: 10
			});

			return aCols;
		},

		/**
		 * Read highlighted tickets and store them in own model
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @private
		 */
		_readTickets: function () {
			this.getView().getModel("AdminApp").read("/HighlightedTickets", {
				success: function (oData) {
					if (!this.getModel("HighlightedTickets")) {
						var oModel = new JSONModel([]);
						oModel.attachPropertyChange(function (oEvent) {
							var oContext = oEvent.getParameter("context");
							var oObject = oContext.getModel().getProperty(oContext.getPath());
							var sProperty = oEvent.getParameter("path");
							var sPath = "";
							//if: existing entries
							if (oObject.ID) {
								sPath = "/HighlightedTickets(guid'" + oObject.ID + "')";
							}
							//else: new entries
							else {
								sPath = oContext.getModel().getProperty(oContext.getPath()).__metadata.deepPath;
							}

							this.getModel("AdminApp").setProperty(sPath + "/" + sProperty, oEvent.getParameter("value"));
						}.bind(this));
						this.getView().setModel(oModel, "HighlightedTickets");
					}

					for (var i = 0; i < oData.results.length; i++) {
						oData.results[i]._editmode = false;
					}
					this.getModel("HighlightedTickets").setData(oData.results);
					this.getModel("HighlightedTickets").refresh();

					//Update table title
					var sTitle = this.getResourceBundle().getText("handlingNotesCount", oData.results.length);
					this.getModel("masterView").setProperty("/title", sTitle);
					this.getModel("masterView").refresh(true);
					this._oTable.setBusy(false);
				}.bind(this),
				error: function (oErr) {
					//	console.log("Could not load HighlightedTickets. Reason: " + oErr);
				}
			});
		},

		/**
		 * Validate if all mandatory fields are filled in the row
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @private
		 */
		_validateTicket: function () {
			var oObject = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath());
			var bIsOK = true;
			if ((oObject.Message === "") || (oObject.Property === "") || (oObject.FilterOperator === "") || (oObject.FilterValue === "") || (oObject.ValidFrom === null) || (oObject.ValidTo === null) || (oObject.Type === "")) {
				bIsOK = false;
			}
			return bIsOK;
		},

		/**
		 * Perform save requests for saving tickets (newly created or existing)
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @private
		 */
		_saveTicket: function () {
			var oObject = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath());
			delete oObject._editmode;

			//if: existing entries
			if (oObject.ID) {
				//submit changes in ticket
				this.getModel("AdminApp").submitChanges({
					success: function () {
						this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath())._editmode = false;
						this.oBindingContext.getModel().refresh(true);
						this.oBindingContext = undefined;
						this.getModel("AdminApp").mChangedEntities = {};
						this._oTable.setBusy(false);
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("saveTicketError"), {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						this.oBindingContext = undefined;
						this._oTable.setBusy(false);
						this.getModel().resetChanges();
					}.bind(this)
				});
			}
			//else: new entries
			else {
				delete oObject.__metadata;
				this.getModel("AdminApp").create("/HighlightedTickets", oObject, {
					success: function (oData) {
						this._readTickets();
						this.getModel("AdminApp").mChangedEntities = {};
						this.oNewEntry = undefined;
						this.oBindingContext = undefined;
						this._oTable.setBusy(false);
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("createTicketError"), {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						this._oTable.setBusy(false);
					}.bind(this)
				});
			}
		},

		/**
		 * Perform delete requests for deleting existing tickets
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @private
		 */
		_deleteTicket: function () {
			var sId = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath()).ID;
			var sPath = "/HighlightedTickets(guid'" + sId + "')";
			this.getModel("AdminApp").remove(sPath, {
				success: function (oData) {
					this.oBindingContext = undefined;
					this._readTickets();
				}.bind(this),
				error: function (oErr) {
					sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("deleteTicketError"), {
						icon: sap.m.MessageBox.Icon.ERROR,
						title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
						actions: [sap.m.MessageBox.Action.CLOSE]
					});
					this._oTable.setBusy(false);
				}.bind(this)
			});
		}

	});

});