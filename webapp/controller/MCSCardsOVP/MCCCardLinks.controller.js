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

	return BaseController.extend("mcc.workbench.admin.settings.controller.MCSCardsOVP.MCCCardLinks", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 */
		onInit: function () {
			this._oTable = this.byId("table");

			this.getView().setModel(new sap.ui.model.json.JSONModel({
				title: this.getResourceBundle().getText("MCCCardLinksCount", [0])
			}), "masterView");

		},

		/**
		 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
		 * (NOT before the first rendering! onInit() is used for that one!).
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 */
		onBeforeRendering: function () {
			this._readCards();
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
					this.oBindingContext = oEvent.getParameter("row").getBindingContext("MCCCardLinksLocal");
					this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath())._editmode = true;
					this.oBindingContext.getModel().refresh(true);
				}
			}
			//else: the save button was pressed
			else {
				if (this._validate()) {
					this._oTable.setBusy(true);
					this._save();
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
			this.oBindingContext = oEvent.getParameter("row").getBindingContext("MCCCardLinksLocal");

			//if: the delete button was pressed
			if (oEvent.getSource().getIcon().indexOf("delete") > -1) {
				// Opens the confirmation dialog
				sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("delete"), {
					icon: sap.m.MessageBox.Icon.WARNING,
					title: this.oView.getModel("i18n").getResourceBundle().getText("delete"),
					actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.OK) {
							this._oTable.setBusy(true);
							this._delete();
						} else {
							this.oBindingContext = undefined;
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
				this._readCards();
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

			this.oNewEntry = this.getModel("AdminApp").createEntry("/MCCCardLinks", {
				properties: {
					Card_CardID: "MCCBackofficeLinks",
					Title: "",
					Icon: "",
					Description: "",
					URL: "",
					Category: "",
					_editmode: true
				}
			});
			this.oBindingContext = this.oNewEntry;
			this.getModel("MCCCardLinksLocal").getData().push(this.getModel("AdminApp").getProperty(this.oNewEntry.getPath()));
			this.getModel("MCCCardLinksLocal").refresh(true);

			//Update table title
			var sTitle = this.getResourceBundle().getText("handlingNotesCount", [this.getModel("MCCCardLinksLocal").getData().length]);
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
						new Filter("Title", FilterOperator.Contains, searchText),
						new Filter("Icon", FilterOperator.Contains, searchText),
						new Filter("Description", FilterOperator.Contains, searchText),
						new Filter("URL", FilterOperator.Contains, searchText),
						new Filter("Category", FilterOperator.Contains, searchText),
						new Filter("Card_CardID", FilterOperator.Contains, searchText)
					],
					and: false
				});

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

			for (var i = 0; i < 5; i++) {
				oColumn.getParent().getColumns()[i].setSorted(false);
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

			oEvent.getSource().getParent().getParent().setFiltered(false);
			aNewFilter = aClearedTableFilters;

			this._oTable.getBinding("rows").filter(aNewFilter);
			this._oTable.getBinding("rows").refresh(true);
		},

		_readCards: function () {
			this.getView().getModel("AdminApp").read("/MCCCardLinks", {
				success: function (oData) {
					if (!this.getModel("MCCCardLinksLocal")) {
						var oModel = new JSONModel([]);
						oModel.attachPropertyChange(function (oEvent) {
							var oContext = oEvent.getParameter("context");
							var oObject = oContext.getModel().getProperty(oContext.getPath());
							var sProperty = oEvent.getParameter("path");
							var sPath = "";
							//if: existing entries
							if (oObject.ID) {
								sPath = "/MCCCardLinks(guid'" + oObject.ID + "')";
							}
							//else: new entries
							else {
								sPath = oContext.getModel().getProperty(oContext.getPath()).__metadata.deepPath;
							}

							this.getModel("AdminApp").setProperty(sPath + "/" + sProperty, oEvent.getParameter("value"));
						}.bind(this));
						this.getView().setModel(oModel, "MCCCardLinksLocal");
					}

					for (var i = 0; i < oData.results.length; i++) {
						oData.results[i]._editmode = false;
					}
					this.getModel("MCCCardLinksLocal").setData(oData.results);
					this.getModel("MCCCardLinksLocal").refresh();

					//Update table title
					var sTitle = this.getResourceBundle().getText("MCCCardLinksCount", oData.results.length);
					this.getModel("masterView").setProperty("/title", sTitle);
					this.getModel("masterView").refresh(true);

					this._oTable.setBusy(false);
				}.bind(this),
				error: function (oErr) {}
			});
		},

		/**
		 * Validate if all mandatory fields are filled in the row
		 * @memberOf mcc.workbench.admin.settings.controller.Assistant.QualificationDispatching.List
		 * @private
		 */
		_validate: function () {
			var oObject = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath());
			var bIsOK = true;
			if ((oObject.Card_CardID === "") || (oObject.Title === "") || (oObject.URL === "") || (oObject.Icon === "")) {
				bIsOK = false;
			}
			return bIsOK;
		},

		_save: function () {
			var oObject = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath());
			delete oObject._editmode;

			//if: existing entries
			if (oObject.ID) {
				//submit changes 
				this.getModel("AdminApp").submitChanges({
					success: function () {
						this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath())._editmode = false;
						this.oBindingContext.getModel().refresh(true);
						this.oBindingContext = undefined;
						this.getModel("AdminApp").mChangedEntities = {};
						this._oTable.setBusy(false);
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("saveError"), {
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
				this.getModel("AdminApp").create("/MCCCardLinks", oObject, {
					success: function (oData) {
						this._readCards();
						this.getModel("AdminApp").mChangedEntities = {};
						this.oNewEntry = undefined;
						this.oBindingContext = undefined;
						this._oTable.setBusy(false);
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("createError"), {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						this._oTable.setBusy(false);
					}.bind(this)
				});
			}
		},

		_delete: function () {
			var sId = this.oBindingContext.getModel().getProperty(this.oBindingContext.getPath()).ID;
			var sPath = "/MCCCardLinks(guid'" + sId + "')";
			this.getModel("AdminApp").remove(sPath, {
				success: function (oData) {
					this.oBindingContext = undefined;
					this._readCards();
				}.bind(this),
				error: function (oErr) {
					sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("deleteError"), {
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