/*
 * Controller for the mail role list view
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
	"sap/ui/core/Fragment"
], function (BaseController, JSONModel, formatter, Constants, MessageBox, Filter, FilterOperator, Spreadsheet, exportLibrary, Fragment) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.Workbench.MailRoles.List", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf mcc.workbench.admin.settings.view.List
		 */
		onInit: function () {
			// Control state model
			var oViewModel = this._createViewModel();

			this._oTable = this.byId("table");
			this.aToBeDeleted = [];
			this.aToBeCreated = [];
			this._inputField = {};

			this.setModel(oViewModel, "masterView");
			this._oODataModel = this.getOwnerComponent().getModel();
			this._AdminModel = this.getOwnerComponent().getModel("AdminApp");
			this._ZS_APP_DEP_Model = this.getOwnerComponent().getModel("ZS_APP_DEP_SRV");

			var oServiceTeamModel = new JSONModel();
			this.setModel(oServiceTeamModel, "serviceTeamDropDownValues");
		},

		/**
		 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
		 * (NOT before the first rendering! onInit() is used for that one!).
		 * @memberOf mcc.workbench.admin.settings.view.List
		 */
		onBeforeRendering: function () {
			this._readServiceTeamHelp();
			this._readEngagementTypeHelp();
			this._readMailTemplates();
			this._readRegionHelp();
			this.loadProductLine(this).then(function () {
				this.loadAllProducts(this);
			}.bind(this));
		},

		/**
		 * Fired by first action Button in the table header (edit or save)
		 * Either set the row to edit mode or save changes and switch back to view mode
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		firstActionPressed: function (oEvent) {
			var oResourceBundle = this.getModel("i18n").getResourceBundle();
			//if: the edit button was pressed
			if (oEvent.getSource().getIcon().indexOf("edit") > -1) {
				this._resetFieldsValueState();
				//only allow to edit one row at a time
				if (this.oBindingContext) {
					var sRoleName = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()).RoleName;
					if (sRoleName.trim() !== "") {
						MessageBox.error(oResourceBundle.getText("PendingChangesErrorRole", sRoleName));
					} else {
						MessageBox.error(oResourceBundle.getText("PendingChangesError"));
					}
				} else {
					this.oBindingContext = oEvent.getParameter("row").getBindingContext("MailRoles");
					this.oBindingContext.getModel("AdminApp").setProperty(this.oBindingContext.getPath() + "/_editmode", true);
					this.oBindingContext.getModel("AdminApp").refresh(true);
				}
				this.getView().getModel("RegionHelpFiltered").setData(this.getView().getModel("RegionHelp").getData()); // reset region help model for dropdown
			}
			//else: the save button was pressed
			else {
				var bValid = this._validateMailRole();
				if (bValid === true) {
					this._oTable.setBusy(true);
					this._saveMailRole();
				} else if (bValid === "mail") {
					sap.m.MessageBox.error(oResourceBundle.getText("mandatoryMail"));
				} else if (bValid === "product") {
					sap.m.MessageBox.error(oResourceBundle.getText("multipleProducts"));
				} else {
					sap.m.MessageBox.error(oResourceBundle.getText("mandatoryFields"));
				}
			}
		},

		/**
		 * Fired by second action Button in the table header (delete or cancel)
		 * Either prepare the row to be deleted or cancel the edited fields and switch back to view mode
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		secondActionPressed: function (oEvent) {
			this.oBindingContext = oEvent.getParameter("row").getBindingContext("MailRoles");

			//if: the delete button was pressed
			if (oEvent.getSource().getIcon().indexOf("delete") > -1) {
				// Opens the confirmation dialog
				var sObjectHeader = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()).RoleName;
				sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("deleteText", sObjectHeader), {
					icon: sap.m.MessageBox.Icon.WARNING,
					title: this.oView.getModel("i18n").getResourceBundle().getText("delete"),
					actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.OK) {
							this._oTable.setBusy(true);
							this._deleteMailRole();
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
				this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath())._editmode = false;
				this._readMailRoles();
				this.oBindingContext.getModel("AdminApp").refresh(true);
				//reset all parameters
				this.aToBeCreated = [];
				this.aToBeDeleted = [];
				this._toCC = undefined;
				this.oBindingContext = undefined;
			}
		},

		/**
		 * Fired by column filter menu of role type
		 * Filter function for role type column as the values are stored in the value help
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with entering the search term
		 */
		onFilter: function (oEvent) {
			var sValue = oEvent.getParameter("item").getProperty("value");
			var oValueHelp = this.getView().getModel("oValueHelp").getData()["RoleTypes"];
			var aTableFilters = this._oTable.getBinding("rows").aFilters;
			var aClearedTableFilters = [];
			var aFilter = [];
			var aNewFilter = [];

			for (var j = 0; j < aTableFilters.length; j++) {
				if (aTableFilters[j].sPath !== "RoleType") {
					aClearedTableFilters.push(aTableFilters[j]);
				}
			}

			if (sValue.trim() === "") {
				oEvent.getSource().getParent().getParent().setFiltered(false);
				aNewFilter = aClearedTableFilters;
			} else {
				oEvent.getSource().getParent().getParent().setFiltered(true);
				for (var i = 0; i < oValueHelp.length; i++) {
					if (oValueHelp[i].value.toUpperCase().indexOf(sValue.toUpperCase()) > -1) {
						aFilter.push(new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, oValueHelp[i].key));
					}
				}
				if (aFilter.length === 0) {
					aFilter.push(new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, sValue));
				}
				aNewFilter = aClearedTableFilters.concat(aFilter);
			}

			this._oTable.getBinding("rows").filter(aNewFilter);
			this._oTable.getBinding("rows").refresh(true);

		},

		/**
		 * Fired by column sort menu of role type
		 * Sort function for role type column
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the menu button
		 */
		onSort: function (oEvent) {
			var bIsDesc = oEvent.getSource().getIcon().indexOf("desc") > -1;
			oEvent.getSource().getParent().getParent().setSorted(true);
			this._oTable.getBinding("rows").sort(new sap.ui.model.Sorter("RoleType", bIsDesc));
			this._oTable.getBinding("rows").refresh(true);
		},

		/**
		 * Fired by column menu of mail mappings
		 * Filter function for mail mappings column
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with entering the search term
		 */
		onFilterTemplates: function (oEvent) {
			var bFilter = false;
			if (oEvent.getId().indexOf("selectionFinish") > -1) {
				var aSelectedItems = oEvent.getParameter("selectedItems");
			} else {
				var sValue = oEvent.getParameter("item").getProperty("value");
				bFilter = true;
			}
			var aTableFilters = this._oTable.getBinding("rows").aFilters;
			var aClearedTableFilters = [];
			var aFilter = [];
			var aNewFilter = [];

			for (var j = 0; j < aTableFilters.length; j++) {
				if (aTableFilters[j].sPath !== "_Role2TemplateString") {
					aClearedTableFilters.push(aTableFilters[j]);
				}
			}

			if (bFilter) {
				var aFittingTemplates = formatter.formatTemplateName(sValue, this.getModel("EmailTemplates").getData());
				if (sValue.trim() === "") {
					oEvent.getSource().getParent().getParent().setFiltered(false);
					aNewFilter = aClearedTableFilters;
				} else {
					oEvent.getSource().getParent().getParent().setFiltered(true);
					for (var i = 0; i < aFittingTemplates.length; i++) {
						aFilter.push(new sap.ui.model.Filter("_Role2TemplateString", sap.ui.model.FilterOperator.Contains, aFittingTemplates[i]));
					}

					if (aFilter.length === 0) {
						aFilter.push(new sap.ui.model.Filter("_Role2TemplateString", sap.ui.model.FilterOperator.Contains, sValue));
					}
					aNewFilter = aClearedTableFilters.concat(aFilter);
				}
			} else {
				for (var i = 0; i < aSelectedItems.length; i++) {
					var aFittingTemplates = formatter.formatTemplateName(aSelectedItems[i].getKey(), this.getModel("EmailTemplates").getData());
					aFilter.push(new sap.ui.model.Filter("_Role2TemplateString", sap.ui.model.FilterOperator.Contains, aFittingTemplates[0]));
				}
				aNewFilter = aClearedTableFilters.concat(aFilter);
			}

			this._oTable.getBinding("rows").filter(aNewFilter);
			this._oTable.getBinding("rows").refresh(true);

			this._updateHeader();
		},

		onSuggestCountry: function (oEvent) {
			//	this.oView.getModel("MailRoles").setProperty(oEvent.getSource().getParent().getParent().getBindingContext("MailRoles").getPath() + "/country", null);
			this.getView().getModel("RegionHelpFiltered").setData([]);
			var text = oEvent.getParameter("suggestValue");
			var countries = this.getView().getModel("RegionHelp").getData();
			countries = countries.filter(function (country) {
				return country.country.indexOf(text) === 0;
			});
			this.getView().getModel("RegionHelpFiltered").setData(countries);
			this.getView().getModel("RegionHelpFiltered").refresh(true);
		},

		/* =========================================================== */
		/* begin: Table Header Functions		                       */
		/* =========================================================== */

		/**
		 * Fired by add button in the table header
		 * Creates a new entry and adds a row at the top of the table
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the +  button
		 */
		onCreate: function (oEvent) {
			var oResourceBundle = this.getModel("i18n").getResourceBundle();
			this._resetFieldsValueState();
			//only allow to edit one row at a time
			if (this.oBindingContext) {
				var sRoleName = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()).RoleName;
				if (sRoleName.trim() !== "") {
					MessageBox.error(oResourceBundle.getText("PendingChangesErrorRole", sRoleName));
				} else {
					MessageBox.error(oResourceBundle.getText("PendingChangesError"));
				}
				return;
			}

			this.oNewEntry = this.getModel("AdminApp").createEntry("/MailRoles", {
				properties: {
					RoleName: "",
					UserName: "",
					Recipients: "",
					RoleType: "",
					Position: "",
					country: "",
					region: "",
					subregion: "",
					subsubregion: "",
					subsubsubregion: "",
					SolutionArea: "",
					ServiceTeam: "",
					PartnerId: "",
					Customer: "",
					MCCTag: "",
					Product: "",
					ProductLine: "",
					EngagementType: "",
					_editmode: true,
					_toCC: false
				}
			});
			this.oBindingContext = this.oNewEntry;
			this.getModel("MailRoles").getData().push(this.getModel("AdminApp").getProperty(this.oNewEntry.getPath()));
			this.getModel("MailRoles").refresh(true);

			//Reset sorter, that new entry is always on top
			this._oTable.getBinding("rows").sort(new sap.ui.model.Sorter("RoleName", false));
			this._oTable.getBinding("rows").refresh(true);

			//Update table title
			var sTitle = this.getResourceBundle().getText("mailRolesCount", [this.getModel("MailRoles").getData().length]);
			this.getModel("masterView").setProperty("/title", sTitle);
		},

		/**
		 * Fired by search bar in the table header
		 * Search the term in all columns
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with entering the search term
		 */
		onSearch: function (oEvent) {
			var searchText = oEvent.getParameter("query");
			var oValueHelp = this.getView().getModel("oValueHelp").getData()["RoleTypes"];

			if (searchText.trim() !== "") {
				var filter = new Filter({
					filters: [
						new Filter("RoleName", FilterOperator.Contains, searchText),
						new Filter("UserName", FilterOperator.Contains, searchText),
						new Filter("Recipients", FilterOperator.Contains, searchText),
						new Filter("Customer", FilterOperator.Contains, searchText),
						new Filter("SolutionArea", FilterOperator.Contains, searchText),
						new Filter("ServiceTeam", FilterOperator.Contains, searchText),
						new Filter("MCCTag", FilterOperator.Contains, searchText),
						new Filter("country", FilterOperator.Contains, searchText),
						new Filter("region", FilterOperator.Contains, searchText),
						new Filter("subregion", FilterOperator.Contains, searchText),
						new Filter("subsubregion", FilterOperator.Contains, searchText),
						new Filter("subsubsubregion", FilterOperator.Contains, searchText),
						new Filter("EngagementType", FilterOperator.Contains, searchText)
					],
					and: false
				});
				for (var i = 0; i < oValueHelp.length; i++) {
					if (oValueHelp[i].value.toUpperCase().indexOf(searchText.toUpperCase()) > -1) {
						filter.aFilters.push(new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, oValueHelp[i].key));
					}
				}
				this._oTable.getBinding("rows").filter(filter, sap.ui.model.FilterType.Application);
			} else {
				this._oTable.getBinding("rows").filter([], sap.ui.model.FilterType.Application);
			}
			this._updateHeader();
		},

		/**
		 * Fired by export button in the table header
		 * Downloads the currently displayed table as excel
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */

		onExcelExport: function (oEvent) {
			var aCols, oSettings, oSheet;
			var currentTable = [];
			var now = new Date();
			var currentTableBinding = this.getView().byId("table").getBinding("rows");
			var rowIndexes = currentTableBinding.aIndices;
			for (var i = 0; i < rowIndexes.length; i++) {
				var currentIndex = rowIndexes[i];
				var currentRow = currentTableBinding.oList[currentIndex];
				currentTable.push(currentRow);
			}
			aCols = this._createColumnConfig();
			var sFileName = "Mail_Roles_" + now.toISOString() + ".xlsx";

			oSettings = {
				workbook: {
					columns: aCols,
					hierarchyLevel: 'Level'
				},
				dataSource: currentTable,
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
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @returns {array} An array with all columns
		 */
		_createColumnConfig: function () {
			var aCols = [];
			var oResourceBundle = this.getModel("i18n").getResourceBundle();
			var EdmType = exportLibrary.EdmType;

			aCols.push({
				label: oResourceBundle.getText("roleName"),
				property: "RoleName",
				type: EdmType.String,
				width: 40
			});
			aCols.push({
				label: "Name",
				property: "UserName",
				type: EdmType.String,
				width: 40
			});
			aCols.push({
				label: oResourceBundle.getText("recipients"),
				property: "Recipients",
				type: EdmType.String,
				width: 55
			});
			aCols.push({
				label: oResourceBundle.getText("roleType"),
				property: "RoleType",
				type: EdmType.String
			});
			aCols.push({
				label: oResourceBundle.getText("position"),
				property: "Position",
				type: EdmType.Int
			});
			aCols.push({
				label: oResourceBundle.getText("EngagementType"),
				property: "EngagementType",
				type: EdmType.String
			});
			aCols.push({
				label: oResourceBundle.getText("customer"),
				property: "Customer",
				type: EdmType.String
			});
			aCols.push({
				label: oResourceBundle.getText("serviceTeam"),
				property: "ServiceTeam",
				type: EdmType.String,
				width: 40
			});
			aCols.push({
				label: oResourceBundle.getText("mccTag"),
				property: "MCCTag",
				type: EdmType.String,
				width: 40
			});
			aCols.push({
				label: oResourceBundle.getText("solutionArea"),
				property: "SolutionArea",
				type: EdmType.String,
				width: 40
			});

			aCols.push({
				label: oResourceBundle.getText("country"),
				property: "country",
				type: EdmType.String
			});
			aCols.push({
				label: oResourceBundle.getText("region"),
				property: "region",
				type: EdmType.String
			});
			aCols.push({
				label: oResourceBundle.getText("subRegion"),
				property: "subregion",
				type: EdmType.String
			});
			aCols.push({
				label: oResourceBundle.getText("subsubRegion"),
				property: "subsubregion",
				type: EdmType.String
			});
			aCols.push({
				label: oResourceBundle.getText("subsubsubRegion"),
				property: "subsubsubregion",
				type: EdmType.String
			})
			aCols.push({
				label: oResourceBundle.getText("associatedMailTemplates"),
				property: "_MailTemplatesString",
				type: EdmType.String,
				width: 55
			});

			return aCols;
		},

		/* =========================================================== */
		/* begin: Table Functions				                       */
		/* =========================================================== */

		/**
		 * Fired by value help buttons in the table for service team field
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		onServiceTeamPressed: function (oEvent) {
			this._inputField = oEvent.getSource();
			this._oServiceTeamValueHelpFragment = sap.ui.xmlfragment(this.getView().getId(),
				"mcc.workbench.admin.settings.view.Workbench.MailRoles.ServiceTeamValueHelp",
				this);
			this.getView().addDependent(this._oServiceTeamValueHelpFragment);
			this._oServiceTeamValueHelpFragment.open();
		},

		/**
		 * Fired when closing service team value help dialog with selection or cancel button
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 */
		_handleValueHelpClose: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem"),
				oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());

			if (oSelectedItem) {
				var path = oSelectedItem.getBindingContextPath();
				var value = oSelectedItem.getBindingContext("serviceTeamDropDownValues").getModel().getProperty(path);
				var key = value.DropdownKey;
				if (key.startsWith("00")) key = Number(value.DropdownKey).toString();//remove leading zeros
				if (oObject.RoleID) this.getView().getModel("MailRoles").setProperty(this.oBindingContext.getPath() + "/ServiceTeam", key);
				else this.getView().getModel("MailRoles").setProperty("/" + (this.getView().getModel("MailRoles").getData().length - 1) + "/ServiceTeam", key);
				//attach property change not triggered..
				if (oObject.RoleID) var sPath = "/MailRoles(guid'" + oObject.RoleID + "')";	//if: existing entry								
				else var sPath = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()).__metadata.deepPath;//else: new entry
				this.getModel("AdminApp").setProperty(sPath + "/ServiceTeam", key);

				if (oObject.RoleType === Constants.RoleTypes.Service_Team) {
					this.getModel("masterView").setProperty("/Service_TeamFieldsValueState", "None");
				}
			}
			oEvent.getSource().getBinding("items").filter([]);
		},

		/**
		 * Fired by search in service team value help
		 * Updates the list binding in the value help
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 */
		_handleValueHelpSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter([
				new Filter("DropdownValue", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("DropdownKey", sap.ui.model.FilterOperator.Contains, sValue)
			],
				false
			);
			oEvent.getSource().getBinding("items").filter([oFilter]);
		},

		onMCCTagPressed: function (oEvent) {
			this._inputField = oEvent.getSource();
			this._oMCCTagValueHelpFragment = sap.ui.xmlfragment(this.getView().getId(),
				"mcc.workbench.admin.settings.view.Workbench.MailRoles.MCCTagValueHelp",
				this);
			this.getView().addDependent(this._oMCCTagValueHelpFragment);
			this._oMCCTagValueHelpFragment.open();
			var oFilterDate = new Filter([
				new Filter("DateFrom", sap.ui.model.FilterOperator.LE, new Date()),
				new Filter("DateTo", sap.ui.model.FilterOperator.GE, new Date())
			],
				true
			);
			this._oMCCTagValueHelpFragment.getBinding("items").filter([oFilterDate]);
		},
		_handleTagClose: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem"),
				oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());

			if (oSelectedItem) {
				//	var sSelectedId = oSelectedItem.getDescription();
				var sSelectedTitle = oSelectedItem.getTitle();
				this._inputField.setValue(sSelectedTitle);

				if (oObject.RoleType === Constants.RoleTypes.MCC_Tag) {
					this.getModel("masterView").setProperty("/MCCTag_ValueState", "None");
				}
			}
			oEvent.getSource().getBinding("items").filter([]);
		},
		_handleTagSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilterSearch = new Filter([
				new Filter("Name", sap.ui.model.FilterOperator.Contains, sValue),
				new Filter("Description", sap.ui.model.FilterOperator.Contains, sValue)
			],
				false
			);
			var oFilterDate = new Filter([
				new Filter("DateFrom", sap.ui.model.FilterOperator.LE, new Date()),
				new Filter("DateTo", sap.ui.model.FilterOperator.GE, new Date())
			],
				true
			);
			oEvent.getSource().getBinding("items").filter([oFilterSearch, oFilterDate]);
		},

		openProductDialog: function (oEvent) {
			this._inputField = oEvent.getSource();
			var load;
			if (!this.oView.getModel("ProductLines")) var load = this.loadProductLine(this);
			if (this.oView.getModel("AllProducts")) this.oView.getModel("Products").setData(this.oView.getModel("AllProducts").getData());
			Promise.all([load]).then(function () {
				if (!this.oSolutionDialog) {
					this.oSolutionDialog = sap.ui.xmlfragment(this.oView.getId(),
						"mcc.workbench.admin.settings.view.SolutionHub.Events.AffectedProductDialog", this);
					this.oView.addDependent(this.oSolutionDialog);
					this.oView.byId("btnClear").setVisible(true);
				}
				var navCon = this.oView.byId("navContainer");
				this.oView.byId("buttonAdd").setEnabled(false);
				navCon.to(this.oView.byId("selectProductLine"), "slide");
				this.oSolutionDialog.open();
			}.bind(this));
		},
		handleClear: function () {
			this._inputField.setValue("");
			var index = this._inputField.getParent().getBindingContext("MailRoles").getPath();
			var guid = this.oView.getModel("MailRoles").getProperty(index + "/RoleID");
			this.getModel("AdminApp").setProperty("/MailRoles(guid'" + guid + "')/Product", "");
			this.oView.getModel("MailRoles").setProperty(index + "/Product", "");
			this.oSolutionDialog.close();
		},
		addSolution: function () {
			this.oSolutionDialog.setBusy(true);
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
			if (this.oView.byId("listProducts").getSelectedContextPaths().length > 0) {
				var index = this.oView.byId("listProducts").getSelectedContextPaths()[0].substring(1);
				var ProductNR = this.oView.getModel("Products").getData()[index].ProductNR;
				var index2 = this._inputField.getParent().getBindingContext("MailRoles").getPath();
				var guid = this.oView.getModel("MailRoles").getProperty(index2 + "/RoleID");
				if (!guid) this.getModel("AdminApp").setProperty(this.oBindingContext.getPath() + "/Product", ProductNR);
				else this.getModel("AdminApp").setProperty("/MailRoles(guid'" + guid + "')/Product", ProductNR);
				this.oView.getModel("MailRoles").setProperty(index2 + "/Product", ProductNR);
				if (oObject.RoleType === Constants.RoleTypes.Product || oObject.RoleType === Constants.RoleTypes.Regional_Product) {
					this.getModel("masterView").setProperty("/ProductFieldsValueState", "None");
				}
			}
			this.oSolutionDialog.setBusy(false);
			this.oSolutionDialog.close();
		},
		openProductLineDialog: function (oEvent) {
			this._inputField = oEvent.getSource();
			var load;
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
			if (!this.oView.getModel("ProductLines")) var load = this.loadProductLine(this);
			Promise.all([load]).then(function () {
				if (!this.oProductLineDialog) {
					this.oProductLineDialog = sap.ui.xmlfragment(this.oView.getId(),
						"mcc.workbench.admin.settings.view.Workbench.MailRoles.ProductLineDialog", this);
					this.oView.addDependent(this.oProductLineDialog);
					if (oObject.ProductLine) {
						this.oProductLineDialog.getItems().forEach(function (item) {
							if (oObject.ProductLine === item.getDescription()) item.setSelected(true);
						});
					}

				}
				this.oProductLineDialog.open();
				this.oProductLineDialog._getClearButton().setEnabled(true);
				var oDelegate = {
					onclick: function (event) {
						this._inputField.setValue("");
						var index = this._inputField.getParent().getBindingContext("MailRoles").getPath();
						var guid = this.oView.getModel("MailRoles").getProperty(index + "/RoleID");
						this.getModel("AdminApp").setProperty("/MailRoles(guid'" + guid + "')/ProductLine", "");
						this.oView.getModel("MailRoles").setProperty(index + "/ProductLine", "");
					}.bind(this)
				};
				this.oProductLineDialog._getClearButton().addEventDelegate(oDelegate);
			}.bind(this));
		},
		filterProductLine: function (oEvent) {
			var value = oEvent.getParameter("value");
			var filter = new Filter("LineName", "Contains", value);
			this.oProductLineDialog.getBinding("items").filter(filter);
		},
		addProductLine: function (oEvent) {
			this.oProductLineDialog.setBusy(true);
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
			if (oEvent.getParameter("selectedItem")) {
				var LineID = oEvent.getParameter("selectedItem").getDescription();
				var index = this._inputField.getParent().getBindingContext("MailRoles").getPath();
				var guid = this.oView.getModel("MailRoles").getProperty(index + "/RoleID");
				if (!guid) this.getModel("AdminApp").setProperty(this.oBindingContext.getPath() + "/ProductLine", LineID);
				else this.getModel("AdminApp").setProperty(this.oBindingContext.getPath() + "/ProductLine", LineID);
				this.oView.getModel("MailRoles").setProperty(index + "/ProductLine", LineID);
				if (oObject.RoleType === Constants.RoleTypes.Product) {
					this.getModel("masterView").setProperty("/ProductFieldsValueState", "None");
				}
			}
			this.oProductLineDialog.setBusy(false);
		},

		/**
		 * Fired when Role type drop down is changed
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with changing value
		 */
		onRoleTypeChange: function (oEvent) {
			if (oEvent.getParameter("selectedItem")) {
				var sSelectedKey = oEvent.getParameter("selectedItem").getKey(),
					oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()),
					oMasterViewModel = this.getModel("masterView");
				this._resetFieldsValueState();

				if (sSelectedKey === Constants.RoleTypes.Regional && (!(oObject.country) && !(oObject.region) && !(oObject.subregion) && !(oObject
					.subsubregion) && !(oObject.subsubsubregion))) {
					oMasterViewModel.setProperty("/RegionalFieldsValueState", "Error");
				} else if (sSelectedKey === Constants.RoleTypes.Product && !(oObject.SolutionArea) && !(oObject.Product) && !(oObject.ProductLine)) {
					oMasterViewModel.setProperty("/ProductFieldsValueState", "Error");
				} else if (sSelectedKey === Constants.RoleTypes.Global) {
					oMasterViewModel.setProperty("/GlobalFieldsValueState", "Error");
				} else if (sSelectedKey === Constants.RoleTypes.Regional_Product) {
					if (!(oObject.SolutionArea) && !(oObject.Product) && !(oObject.ProductLine)) {
						oMasterViewModel.setProperty("/ProductFieldsValueState", "Error");
					}
					if (!(oObject.country) && !(oObject.region) && !(oObject.subregion) && !(oObject.subsubregion) && !(oObject.subsubsubregion)) {
						oMasterViewModel.setProperty("/RegionalFieldsValueState", "Error");
					}
				} else if (sSelectedKey === Constants.RoleTypes.Customer && !(oObject.Customer)) {
					oMasterViewModel.setProperty("/CustomerFieldsValueState", "Error");
				} else if (sSelectedKey === Constants.RoleTypes.Service_Team && !(oObject.ServiceTeam)) {
					oMasterViewModel.setProperty("/Service_TeamFieldsValueState", "Error");
				} else if (sSelectedKey === Constants.RoleTypes.MCC_Tag && !(oObject.MCCTag)) {
					oMasterViewModel.setProperty("/MCCTag_ValueState", "Error");
				} else if (sSelectedKey === Constants.RoleTypes.Engagement_Type && !(oObject.Engagement_Type)) {
					oMasterViewModel.setProperty("/Enga_ValueState", "Error");
				} else if (sSelectedKey === Constants.RoleTypes.Engagement_Type_Region) {
					if (!(oObject.Engagement_Type)) oMasterViewModel.setProperty("/Enga_ValueState", "Error");
					if (!(oObject.country) && !(oObject.region) && !(oObject.subregion) && !(oObject.subsubregion) && !(oObject.subsubsubregion)) {
						oMasterViewModel.setProperty("/Enga_ValueState", "Error");
					}
				}
			} else {
				this._resetFieldsValueState();
			}
		},

		/**
		 * Fired when on adding new row, editing existing row, and role type change
		 * This method resets value state on mandatory fields
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 */
		_resetFieldsValueState: function () {
			var oMasterViewModel = this.getModel("masterView");

			oMasterViewModel.setProperty("/RegionalFieldsValueState", "None");
			oMasterViewModel.setProperty("/ProductFieldsValueState", "None");
			oMasterViewModel.setProperty("/GlobalFieldsValueState", "None");
			oMasterViewModel.setProperty("/CustomerFieldsValueState", "None");
			oMasterViewModel.setProperty("/Service_TeamFieldsValueState", "None");
			oMasterViewModel.setProperty("/MCCTag_ValueState", "None");
			oMasterViewModel.setProperty("/Enga_ValueState", "None");
		},

		onEngagementTypeChange: function (oEvent) {
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());

			if (!(oObject.EngagementType) &&
				(oObject.RoleType === Constants.RoleTypes.Engagement_Type || oObject.RoleType === Constants.RoleTypes.Engagement_Type_Region)) {
				this.getModel("masterView").setProperty("/Enga_ValueState", "Error");
			} else {
				this.getModel("masterView").setProperty("/Enga_ValueState", "None");
			}
		},

		/**
		 * Fired when customer field is changed
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with changing value
		 */
		onCustomerChange: function (oEvent) {
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());

			if (!(oEvent.getParameter("value")) && oObject.RoleType === Constants.RoleTypes.Customer) {
				this.getModel("masterView").setProperty("/CustomerFieldsValueState", "Error");
			} else {
				this.getModel("masterView").setProperty("/CustomerFieldsValueState", "None");
			}
		},

		/**
		 * Fired when solutions area field is changed
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with changing value
		 */
		onSolutionAreaChange: function (oEvent) {
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());

			if (!(oEvent.getParameter("value")) && ((oObject.RoleType === Constants.RoleTypes.Product) || (oObject.RoleType === Constants.RoleTypes
				.Regional_Product))) {
				this.getModel("masterView").setProperty("/ProductFieldsValueState", "Error");
			} else {
				this.getModel("masterView").setProperty("/ProductFieldsValueState", "None");
			}
		},

		/**
		 * Fired when any of the regional fields are changed
		 * Country, Region, SubRegion, SubSubRegion, SubSubSubRegion
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with changing value
		 */
		onRegionalFieldChange: function (oEvent) {
			if (this.oBindingContext) {
				var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());

				if ((oObject.RoleType === Constants.RoleTypes.Regional) || (oObject.RoleType === Constants.RoleTypes.Regional_Product) || oObject.RoleType ===
					Constants.RoleTypes.Engagement_Type_Region) {
					if ((oObject.country) || (oObject.region) || (oObject.subregion) || (oObject.subsubregion) || (oObject.subsubsubregion)) {
						this.getModel("masterView").setProperty("/RegionalFieldsValueState", "None");
					} else {
						this.getModel("masterView").setProperty("/RegionalFieldsValueState", "Error");
					}
				}
			}
		},

		/* =========================================================== */
		/* begin: Template Association Functions                       */
		/* =========================================================== */

		/**
		 * Fired by value help buttons in the table
		 * Opens associated mail templates
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 * @param {object} oEvent The oEvent that comes with pressing the button
		 */
		onValueHelpPressed: function (oEvent) {
			var oContext = oEvent.getSource().getParent().getBindingContext("MailRoles");
			var oObject = oContext.getModel("AdminApp").getProperty(oContext.getPath());

			if (!this.getModel("MailTemplates")) {
				this.getView().setModel(new JSONModel([]), "MailTemplates");
			}
			if (oObject.MailTemplates) {
				var oRole2TemplateData = oObject.MailTemplates.results
			} else {
				var oRole2TemplateData = {};
			}

			this.getModel("MailTemplates").setData(oRole2TemplateData);
			this.getModel("MailTemplates").refresh();

			//if: view associations in view mode
			if (oEvent.getSource().getType() === "Default") {
				var oList = new sap.m.List();
				var oPopover = new sap.m.Popover({
					placement: "Left",
					title: "Associated Templates",
					titleAlignment: "Center",
					content: oList
				}).addStyleClass("sapUiContentPadding");
				oList.setModel(this.getModel("MailTemplates"));
				oList.bindItems({
					path: "/",
					sorter: new sap.ui.model.Sorter("Profile", false, true),
					filters: [
						new Filter("TemplateType", FilterOperator.Contains, 'Mail'),
						new Filter("Profile", FilterOperator.NE, '')
					],
					template: new sap.m.StandardListItem({
						title: {
							parts: [{
								path: 'MailTemplate_TemplateID'
							}, {
								value: this.getModel("EmailTemplates").getData()
							}],
							formatter: formatter.formatTemplateID
						}
					}),
					templateShareable: false
				});
				this.getView().addDependent(oPopover);
				oPopover.openBy(oEvent.getSource());
			}
			//if: view associations in edit mode
			else {
				this.EditMailTemplate = sap.ui.xmlfragment(this.getView().getId(),
					"mcc.workbench.admin.settings.view.Workbench.MailRoles.EditMailTemplates",
					this);
				this.getView().addDependent(this.EditMailTemplate);
				this.EditMailTemplate.open();
			}
		},
		MailTemplateVisibility: function (profile) {
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
			if (profile && Constants.Profiles[profile].includes(oObject.RoleType)) return true;
			else return false;
		},

		onChangeLogPressed: function (oEvent) {
			var oContext = oEvent.getSource().getParent().getBindingContext("MailRoles");
			var oObject = oContext.getModel("AdminApp").getProperty(oContext.getPath());
			var oBtn = oEvent.getSource();

			this._AdminModel.read("/MailRoles(guid'" + oObject.RoleID + "')", {
				urlParameters: {
					"$expand": "Changelogs"
				},
				success: function (oData) {
					if (oData.Changelogs) {
						this.getView().setModel(new JSONModel(oData.Changelogs.results), "ChangeLog");

						var oList = new sap.m.List();
						var oPopover = new sap.m.Popover({
							placement: "Left",
							title: "ChangeLog",
							titleAlignment: "Center",
							content: oList
						}).addStyleClass("sapUiContentPadding");
						oList.setModel(this.getModel("ChangeLog"));
						oList.bindItems({
							path: "/",
							sorter: new sap.ui.model.Sorter("ChangedAt", true, true),
							template: new sap.m.StandardListItem({
								title: {
									parts: [{
										path: 'EventType'
									}, {
										path: 'ChangedBy'
									}, {
										path: 'ChangedAt',
										type: 'sap.ui.model.type.DateTime',
										formatOptions: {
											style: 'short'
										}
									}],
									formatter: formatter.formatChangeLogTitle

								},
								description: {
									path: 'CurrentValue'

								}
							}),
							templateShareable: false
						});
						this.getView().addDependent(oPopover);
						oPopover.openBy(oBtn);
					} else MessageBox.information("No changelog available.");
				}.bind(this),
				error: function (oErr) {
					MessageBox.information("No changelog available.");
				}.bind(this)
			});
		},

		/**
		 * Fired when closing value help dialog with save or cancel button
		 * Destorys the dialog, that formatter is called every time when oping the dialog
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 */
		onValueHelpDialogClose: function (oEvent) {
			this.EditMailTemplate.destroy();

			if (oEvent.getId() === "cancel") {
				return;
			}

			var aStoredTemplates = this.getModel("MailTemplates").getData();
			var aValidMailTemplates = this.getModel("EmailTemplates").getData();

			// remove Templates which the user has no access to
			if (aStoredTemplates.filter !== undefined) {
				aStoredTemplates = aStoredTemplates.filter(function (oStoredTemplate) {
					return aValidMailTemplates.find(function (oValidTemplate) {
						return oValidTemplate.TemplateID === oStoredTemplate.MailTemplate_TemplateID;
					});
				});
			}

			var aSelectedTemplates = oEvent.getParameter("selectedItems");
			var oBindingContext;
			var sSelectedTemplate;

			//collect templates that need to be added
			for (var i = 0; i < aSelectedTemplates.length; i++) {
				oBindingContext = aSelectedTemplates[i].getBindingContext("EmailTemplates");
				sSelectedTemplate = oBindingContext.getModel("AdminApp").getProperty(oBindingContext.getPath()).TemplateID;
				var bTemplateExists = false;

				for (var j = 0; j < aStoredTemplates.length; j++) {
					if (aStoredTemplates[j].MailTemplate_TemplateID === sSelectedTemplate) {
						bTemplateExists = true;
					}
				}

				if (!bTemplateExists) {
					var sValue = "CC";
					if (this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath())._toCC) {
						sValue = "To";
					}
					this.aToBeCreated.push({
						MailTemplate_TemplateID: sSelectedTemplate,
						MailRole_RoleID: this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()).RoleID,
						Editable: false,
						ToOrCC: sValue
					});
				}
			}

			//remove deselected from aToBeCreated
			for (var k = 0; k < this.aToBeCreated.length; k++) {
				var bIsStillSelected = false;
				for (var l = 0; l < aSelectedTemplates.length; l++) {
					oBindingContext = aSelectedTemplates[l].getBindingContext("EmailTemplates");
					sSelectedTemplate = oBindingContext.getModel("AdminApp").getProperty(oBindingContext.getPath()).TemplateID;
					if (this.aToBeCreated[k].MailTemplate_TemplateID === sSelectedTemplate) {
						bIsStillSelected = true;
					}
				}
				if (!bIsStillSelected) {
					this.aToBeCreated.splice(k, 1);
				}
			}

			//collect templates that need to be deleted
			for (var a = 0; a < aStoredTemplates.length; a++) {
				var bTemplateIsSelected = false;

				for (var b = 0; b < aSelectedTemplates.length; b++) {
					oBindingContext = aSelectedTemplates[b].getBindingContext("EmailTemplates");
					sSelectedTemplate = oBindingContext.getModel("AdminApp").getProperty(oBindingContext.getPath()).TemplateID;
					if (aStoredTemplates[a].MailTemplate_TemplateID === sSelectedTemplate) {
						bTemplateIsSelected = true;
					}

				}

				if (!bTemplateIsSelected) {
					this.aToBeDeleted.push(aStoredTemplates[a]);
				}

			}
		},

		/**
		 * Fired by search in value help
		 * Updates the list binding in the value help
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @public
		 */
		onValuehelpDialogSearch: function (oEvent) {
			var searchText = oEvent.getParameter("value");

			if (searchText.trim() !== "") {
				var filter = new Filter({
					filters: [
						new Filter("TemplateDescription", FilterOperator.Contains, searchText),
						new Filter("TemplateName", FilterOperator.Contains, searchText)
					],
					and: false
				});
				oEvent.getSource().getBinding("items").filter(filter, sap.ui.model.FilterType.Application);
			} else {
				oEvent.getSource().getBinding("items").filter([], sap.ui.model.FilterType.Application);
			}
		},

		/* =========================================================== */
		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */
		/* =========================================================== */

		/**
		 * Creates the model for the view
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 * @returns {object} The JSON model with the model properties
		 */
		_createViewModel: function () {
			return new JSONModel({
				isFilterBarVisible: false,
				filterBarLabel: "",
				delay: 0,
				title: this.getResourceBundle().getText("mailRolesCount", [0]),
				sortBy: "RoleName",
				groupBy: "None",
				RegionalFieldsValueState: "None",
				ProductFieldsValueState: "None",
				GlobalFieldsValueState: "None",
				CustomerFieldsValueState: "None",
				Service_TeamFieldsValueState: "None",
				MCCTag_ValueState: "None",
				Enga_ValueState: "None"
			});
		},

		/**
		 * Perform save requests for saving mail roles (newly created or existing)
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 */
		_saveMailRole: function () {
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
			delete oObject.__metadata;
			delete oObject._editmode;
			delete oObject._toCC;

			//if: existing entries
			if (oObject.RoleID) {
				var allPromises = [];
				if (this.aToBeCreated.length !== 0) {
					allPromises.push(this._createTemplate2Role());
				}
				if (this.aToBeDeleted.length !== 0) {
					allPromises.push(this._deleteTemplate2Role());
				}
				if (this._toCC !== undefined) {
					allPromises.push(this._saveToOrCC());
				}
				Promise.all(allPromises).then(function () {
					//reset all parameters
					this.aToBeCreated = [];
					this.aToBeDeleted = [];
					this._toCC = undefined;
					//submit changes in mail role

					var aKeys = Object.keys(this.getModel("AdminApp").mChangedEntities);
					for (var i = 0; i < aKeys.length; i++) {
						this.getModel("AdminApp").mChangedEntities[aKeys[i]] = this._convertEmptyStringToNull(this.getModel("AdminApp").mChangedEntities[
							aKeys[i]]);
						this.getModel("AdminApp").mChangedEntities[aKeys[i]] = this._convertPositionToInt(this.getModel("AdminApp").mChangedEntities[
							aKeys[i]]);
						//this.getModel("AdminApp").mChangedEntities[aKeys[i]] = this._convertServiceTeam(this.getModel("AdminApp").mChangedEntities[
						//	aKeys[i]]);
						delete this.getModel("AdminApp").mChangedEntities[aKeys[i]].__metadata;
					}
					this.getModel("AdminApp").submitChanges({
						success: function () {
							this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath())._editmode = false;
							this._readMailRoles();
							this.oBindingContext = undefined;
							this.getModel("AdminApp").resetChanges();
						}.bind(this),
						error: function (oErr) {
							sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("saveMailRoleError"), {
								icon: sap.m.MessageBox.Icon.ERROR,
								title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
								actions: [sap.m.MessageBox.Action.CLOSE]
							});
							this.oBindingContext = undefined;
							this._oTable.setBusy(false);
							this.getModel("AdminApp").resetChanges();
						}.bind(this)
					});
				}.bind(this));
			}
			//else: new entries
			else {
				oObject = this._convertEmptyStringToNull(oObject);
				oObject = this._convertPositionToInt(oObject);
				//	oObject = this._convertServiceTeam(oObject);
				this.getModel("AdminApp").create("/MailRoles", oObject, {
					success: function (oData) {
						//create associations
						var allPromises = [];
						if (this.aToBeCreated.length !== 0) {
							//set new role id in all associations
							for (var a = 0; a < this.aToBeCreated.length; a++) {
								this.aToBeCreated[a].MailRole_RoleID = oData.RoleID;
							}
							allPromises.push(this._createTemplate2Role());
						}
						Promise.all(allPromises).then(function () {
							this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath())._editmode = false;
							this._readMailRoles();
							//reset all parameters
							this.aToBeCreated = [];
							this.aToBeDeleted = [];
							this._toCC = undefined;
							this.getModel("AdminApp").resetChanges();
							this.oNewEntry = undefined;
							this.oBindingContext = undefined;
						}.bind(this));
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("createMailRoleError"), {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						this.oBindingContext = undefined;
						this.oNewEntry = undefined;
						this._oTable.setBusy(false);
						this.getModel("AdminApp").resetChanges();
					}.bind(this)
				});
			}
		},

		/*_convertServiceTeam: function (oObject) {
			if (oObject.ServiceTeamID) {
				oObject.ServiceTeam = oObject.ServiceTeamID;
				delete oObject.ServiceTeamID;
			}

			return oObject;
		},*/

		/**
		 * Remove all empty strings and set them to null
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 * @returns {object} The object with cleared entries
		 */
		_convertEmptyStringToNull: function (oObject) {
			var aKeys = Object.keys(oObject);
			for (var i = 0; i < aKeys.length; i++) {
				if (typeof oObject[aKeys[i]] === "string") {
					if (oObject[aKeys[i]].trim() === "") {
						oObject[aKeys[i]] = null;
					}
				}
			}
			return oObject;
		},

		/**
		 * Convert position string value to int
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 * @returns {object} The object with int position value
		 */
		_convertPositionToInt: function (oObject) {
			if (oObject.Position) {
				oObject.Position = Number(oObject.Position);
			}
			return oObject;
		},

		/**
		 * Create new association between the role and selected templates
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 * @returns {promise} The promise of creating all associations
		 */
		_createTemplate2Role: function () {
			return new Promise(function (resolve, reject) {
				var allPromises = [];
				//remove duplicates
				this.aToBeCreated = Array.from(new Set(this.aToBeCreated.map(a => a.MailTemplate_TemplateID)))
					.map(MailTemplate_TemplateID => {
						return this.aToBeCreated.find(a => a.MailTemplate_TemplateID === MailTemplate_TemplateID)
					})

				for (var i = 0; i < this.aToBeCreated.length; i++) {
					var promise = new Promise(function (resolveCreate, rejectCreate) {
						if (this._toCC !== undefined) {
							var sValue = "CC";
							if (this._toCC) {
								sValue = "To";
							}
							this.aToBeCreated[i].ToOrCC = sValue;
						}
						this.getModel("AdminApp").create("/Templates2RolesTable", this.aToBeCreated[i], {
							success: function (oData) {
								resolveCreate();
							},
							error: function (oErr) {
								resolveCreate();
								this._oTable.setBusy(false);
							}.bind(this)
						});
					}.bind(this));
					allPromises.push(promise);
				}
				Promise.all(allPromises).then(function () {
					resolve();
				});
			}.bind(this));
		},

		/**
		 * Delete deselected templates from the role
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 * @returns {promise} The promise of deleting all associations
		 */
		_deleteTemplate2Role: function () {
			return new Promise(function (resolve, reject) {
				var allPromises = [];
				//remove duplicates
				this.aToBeDeleted = Array.from(new Set(this.aToBeDeleted.map(a => a.MailTemplate_TemplateID)))
					.map(MailTemplate_TemplateID => {
						return this.aToBeDeleted.find(a => a.MailTemplate_TemplateID === MailTemplate_TemplateID)
					})

				for (var i = 0; i < this.aToBeDeleted.length; i++) {
					var sPath = "/Templates2RolesTable(MailTemplate_TemplateID=guid'" + this.aToBeDeleted[i].MailTemplate_TemplateID +
						"',MailRole_RoleID=guid'" + this.aToBeDeleted[i].MailRole_RoleID + "')";
					var promise = new Promise(function (resolveDelete, rejectDelete) {
						this.getModel("AdminApp").remove(sPath, {
							success: function (oData) {
								resolveDelete();
							},
							error: function (oErr) {
								resolveDelete();
								this._oTable.setBusy(false);
							}.bind(this)
						});
					}.bind(this));
					allPromises.push(promise);
				}
				Promise.all(allPromises).then(function () {
					resolve();
				});
			}.bind(this));
		},

		/**
		 * Saves changes for To Or CC flag in all affected template association
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 * @returns {promise} The promise of saving all changes
		 */
		_saveToOrCC: function () {
			return new Promise(function (resolve, reject) {
				var oCurrentMailRole = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
				var sCurrentRoleID = oCurrentMailRole.RoleID;
				var aCurrentTemplates = oCurrentMailRole.MailTemplates.results;

				var allPromises = [];
				for (var i = 0; i < aCurrentTemplates.length; i++) {
					var bIsDeleted = false;
					//skip if the association is going to be deleted
					for (var j = 0; j < this.aToBeDeleted.length; j++) {
						if (aCurrentTemplates[i].MailRole_RoleID === this.aToBeDeleted[j].MailRole_RoleID && aCurrentTemplates[i].MailTemplate_TemplateID ===
							this.aToBeDeleted[j].MailTemplate_TemplateID) {
							bIsDeleted = true;
						}
					}
					if (bIsDeleted) {
						continue;
					}

					var sPath = "/Templates2RolesTable(MailTemplate_TemplateID=guid'" + aCurrentTemplates[i].MailTemplate_TemplateID +
						"',MailRole_RoleID=guid'" + aCurrentTemplates[i].MailRole_RoleID + "')";
					var promise = new Promise(function (resolveUpdate, rejectUpdate) {
						var sValue = "CC";
						if (this._toCC) {
							sValue = "To";
						}
						this.getModel("AdminApp").update(sPath, {
							ToOrCC: sValue
						}, {
							success: function (oData) {
								resolveUpdate();
							},
							error: function (oErr) {
								resolveUpdate();
								this._oTable.setBusy(false);
							}.bind(this)
						});
					}.bind(this));
					allPromises.push(promise);
				}
				Promise.all(allPromises).then(function () {
					resolve();
				});
			}.bind(this));
		},

		/**
		 * Perform delete requests for deleting existing mail roles
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 */
		_deleteMailRole: function () {
			var sRoleId = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()).RoleID;
			var sPath = "/MailRoles(guid'" + sRoleId + "')";
			//delete associations as well
			this.aToBeDeleted = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()).MailTemplates.results;
			this._deleteTemplate2Role().then(function () {
				this.aToBeDeleted = [];
				this.getModel("AdminApp").remove(sPath, {
					success: function (oData) {
						this.oBindingContext = undefined;
						this._readMailRoles();
						this.getModel("MailRoles").refresh(true);
					}.bind(this),
					error: function (oErr) {
						sap.m.MessageBox.show(this.oView.getModel("i18n").getResourceBundle().getText("deleteMailRoleError"), {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: this.oView.getModel("i18n").getResourceBundle().getText("error"),
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						this.oBindingContext = undefined;
						this._oTable.setBusy(false);
					}.bind(this)
				});
			}.bind(this));
		},

		_validateRoleTypeFields: function (oObject, bIsOK) {
			var iProduct = 0;
			if (oObject.SolutionArea) iProduct++;
			if (oObject.Product) iProduct++;
			if (oObject.ProductLine) iProduct++;
			switch (oObject.RoleType) {
				case Constants.RoleTypes.Regional:
					if ((!oObject.country) && (!oObject.region) && (!oObject.subregion) && (!oObject.subsubregion) &&
						(!oObject.subsubsubregion)) {
						bIsOK = false;
					}
					this._emptyOtherFields(false, true, true, true, true, true);
					break;

				case Constants.RoleTypes.Product:
					if (((!oObject.SolutionArea) && (!oObject.Product) && (!oObject.ProductLine)) || iProduct > 1) {
						bIsOK = false;
					}
					this._emptyOtherFields(true, false, true, true, true, true);
					break;

				case Constants.RoleTypes.Global:
					this._emptyOtherFields(true, true, true, true, true, true);
					break;

				case Constants.RoleTypes.Regional_Product:
					if ((!oObject.SolutionArea && !oObject.Product && !oObject.ProductLine) || iProduct > 1 || ((!oObject.country) && (!oObject.region) &&
						(!oObject.subregion) && (!oObject.subsubregion) && (!oObject.subsubsubregion))) {
						bIsOK = false;
					}
					this._emptyOtherFields(false, false, true, true, true, true);
					break;

				case Constants.RoleTypes.Customer:
					if (!oObject.Customer) {
						bIsOK = false;
					}
					this._emptyOtherFields(true, true, false, true, true, true);
					break;
				case Constants.RoleTypes.Engagement_Type:
					if (!oObject.EngagementType) {
						bIsOK = false;
					}
					this._emptyOtherFields(true, true, true, true, true, false);
					break;
				case Constants.RoleTypes.Engagement_Type_Region:
					if (!oObject.EngagementType ||
						((!oObject.country) && (!oObject.region) && (!oObject.subregion) && (!oObject.subsubregion) && (!oObject.subsubsubregion))) {
						bIsOK = false;
					}
					this._emptyOtherFields(false, true, true, true, true, false);
					break;
				case Constants.RoleTypes.Service_Team:
					if (!oObject.ServiceTeam) {
						bIsOK = false;
					}
					this._emptyOtherFields(true, true, true, false, true, true);
					break;
				case Constants.RoleTypes.MCC_Tag:
					if (!oObject.MCCTag) {
						bIsOK = false;
					}
					this._emptyOtherFields(true, true, true, true, false, true);
					break;

				default:
					bIsOK = true;
					break;
			}
			if (iProduct > 1) return "product";
			else return bIsOK;
		},

		_emptyOtherFields: function (bRegion, bProduct, bCustomer, bST, bTag, bEnga) {
			//attach property change not triggered..
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
			if (oObject.RoleID) var sPath = "/MailRoles(guid'" + oObject.RoleID + "')";	//if: existing entry								
			else var sPath = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath()).__metadata.deepPath;//else: new entry

			if (bRegion) {
				this.getModel("AdminApp").setProperty(sPath + "/country", "");
				this.getModel("AdminApp").setProperty(sPath + "/region", "");
				this.getModel("AdminApp").setProperty(sPath + "/subregion", "");
				this.getModel("AdminApp").setProperty(sPath + "/subsubregion", "");
				this.getModel("AdminApp").setProperty(sPath + "/subsubsubregion", "");
			}
			if (bProduct) {
				this.getModel("AdminApp").setProperty(sPath + "/SolutionArea", "");
				this.getModel("AdminApp").setProperty(sPath + "/Product", "");
				this.getModel("AdminApp").setProperty(sPath + "/ProductLine", "");
			}
			if (bCustomer) this.getModel("AdminApp").setProperty(sPath + "/Customer", "");
			if (bST) this.getModel("AdminApp").setProperty(sPath + "/ServiceTeam", "");
			if (bTag) this.getModel("AdminApp").setProperty(sPath + "/MCCTag", "");
			if (bEnga) this.getModel("AdminApp").setProperty(sPath + "/EngagementType", "");
		},

		/**
		 * Validate if all mandatory fields are filled in the row
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 */
		_validateMailRole: function () {
			var oObject = this.oBindingContext.getModel("AdminApp").getProperty(this.oBindingContext.getPath());
			var bIsOK = true;
			if ((oObject.RoleName === "") || (oObject.Recipients === "") || (oObject.RoleType === "")) {
				bIsOK = false;
			} else if (!oObject.Recipients.includes("@") || (oObject.Recipients.includes(" ") && !((oObject.Recipients.includes("<") && (
				oObject.Recipients.includes(">")))))) {
				bIsOK = "mail";
			}

			if (bIsOK === true) {
				bIsOK = this._validateRoleTypeFields(oObject, bIsOK);
			}

			return bIsOK;
		},

		/**
		 * Validate if all mandatory fields are filled in the row
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 * @param {string} sRoleId The id for the role to find out if CC or To
		 * @returns {boolean} True if it's To and false if it's CC
		 */
		_formatMailTemplatesToCC: function (oMailTemplates) {
			for (var i = 0; i < oMailTemplates.length; i++) {
				if (oMailTemplates[i].ToOrCC === "To") {
					return true;
				} else {
					return false;
				}
			}
			return false;
		},

		/**
		 * Convert a MailTemplates array into a String
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 * @param {array} oMailTemplates The associated mail templates of one table row
		 * @returns {string} Concatenated list of mail templates per profile
		 */
		_stringifyMailTemplates: function (oMailTemplates) {
			var sMailTemplates = "";
			var sMailTemplatesPerProfile;
			var oMailTemplatesPerProfile = new Map();
			oMailTemplates.map(item => {
				if (!oMailTemplatesPerProfile.get(item.Profile)) {
					sMailTemplatesPerProfile = "";
				} else {
					sMailTemplatesPerProfile = sMailTemplatesPerProfile.concat("; ");
				}
				sMailTemplatesPerProfile = sMailTemplatesPerProfile.concat(item.TemplateName);
				oMailTemplatesPerProfile.set(item.Profile, sMailTemplatesPerProfile);
			})

			var sSeparator = " +++ ";
			var count = 1;
			for (var [key, value] of oMailTemplatesPerProfile) {
				sMailTemplates = sMailTemplates.concat(key, ': ', value);

				// append separator when mail templates for mulitple profiles exist 
				if (oMailTemplatesPerProfile.size != count) {
					sMailTemplates = sMailTemplates.concat(sSeparator);
				}
				count++;
			}

			return sMailTemplates;
		},

		/* =========================================================== */
		/* begin: read methods                                  	   */
		/* =========================================================== */

		/**
		 * Read mail roles and store them in own model
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 */
		_readMailRoles: function () {
			//3 requests since we are facing issues with big requests..
			this.getView().setBusy(true);
			var filterCase = new sap.ui.model.Filter("caseID", sap.ui.model.FilterOperator.EQ, null);
			var filterType1 = new sap.ui.model.Filter({
				filters: [
					new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "G"),
					new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "P"),
					new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "Tag"),
					new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "ST"),
					new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "C"),
					new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "ENGA"),
					new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "ENGAR")
				],
				and: false
			});
			var filterType2 = new sap.ui.model.Filter({
				filters: [
					new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "PR")
				],
				and: false
			});
			var filterType3 = new sap.ui.model.Filter({
				filters: [
					new sap.ui.model.Filter("RoleType", sap.ui.model.FilterOperator.EQ, "R")
				],
				and: false
			});

			this._AdminModel.read("/MailRoles", {
				filters: [filterCase, filterType1],
				urlParameters: {
					"$expand": "MailTemplates" //, Changelogs
				},
				success: function (oData1) {
					this._AdminModel.read("/MailRoles", {
						filters: [filterCase, filterType2],
						urlParameters: {
							"$expand": "MailTemplates" //, Changelogs
						},
						success: function (oData2) {
							this._AdminModel.read("/MailRoles", {
								filters: [filterCase, filterType3],
								urlParameters: {
									"$expand": "MailTemplates" //, Changelogs
								},
								success: function (oData3) {
									if (!this.getModel("MailRoles")) {
										var oModel = new JSONModel([]);
										oModel.attachPropertyChange(function (oEvent) {
											var oContext = oEvent.getParameter("context");
											var oObject = oContext.getModel("AdminApp").getProperty(oContext.getPath());
											var sProperty = oEvent.getParameter("path");
											var sPath = "";
											//if ToCC was changed
											if (sProperty === "_toCC") {
												this._toCC = oEvent.getParameter("value");
												return;
											}
											//if: existing entries
											if (oObject.RoleID) {
												sPath = "/MailRoles(guid'" + oObject.RoleID + "')";
											}
											//else: new entries
											else {
												sPath = oContext.getModel("AdminApp").getProperty(oContext.getPath()).__metadata.deepPath;
											}

											this.getModel("AdminApp").setProperty(sPath + "/" + sProperty, oEvent.getParameter("value"));
										}.bind(this));
										this.getView().setModel(oModel, "MailRoles");
									}
									//	var serviceTeamData = this._getServiceTeamDataSet();
									var oData = {
										results: oData1.results.concat(oData2.results.concat(oData3.results))
									};
									for (var i = 0; i < oData.results.length; i++) {
										var oMailTemplates = oData.results[i].MailTemplates.results;
										var sAllTemplates = "";

										oData.results[i]._editmode = false;
										oData.results[i]._toCC = this._formatMailTemplatesToCC(oMailTemplates);
										oData.results[i]._MailTemplatesString = this._stringifyMailTemplates(oMailTemplates);

										//	if (oData.results[i].ServiceTeam) {
										//	oData.results[i].ServiceTeam = serviceTeamData[oData.results[i].ServiceTeam];
										//	}

										for (var a = 0; a < oMailTemplates.length; a++) {
											sAllTemplates = sAllTemplates + " " + oMailTemplates[a].MailTemplate_TemplateID;
										}
										oData.results[i]._Role2TemplateString = sAllTemplates;
									}
									this.getModel("MailRoles").setData(oData.results);
									this.getModel("MailRoles").refresh();

									//Update table title
									var sTitle = this.getResourceBundle().getText("mailRolesCount", [oData.results.length]);
									this.getModel("masterView").setProperty("/title", sTitle);
									this.getModel("masterView").refresh();
									this.getView().byId("btnAddRole").setEnabled(true);
									this._oTable.setBusy(false);
									this.getView().setBusy(false);
								}.bind(this),
								error: function (oErr) {
									if (oErr.statusCode === "403") MessageBox.error("No authorization to access Mail Roles.");
									this.getView().setModel(new JSONModel([]), "MailRoles");
									this.getView().byId("btnAddRole").setEnabled(false);
									this._oTable.setBusy(false);
									this.getView().setBusy(false);
								}.bind(this)
							});
						}.bind(this),
						error: function (oErr) {
							if (oErr.statusCode === "403") MessageBox.error("No authorization to access Mail Roles.");
							this.getView().setModel(new JSONModel([]), "MailRoles");
							this.getView().byId("btnAddRole").setEnabled(false);
							this._oTable.setBusy(false);
							this.getView().setBusy(false);
						}.bind(this)
					});
				}.bind(this),
				error: function (oErr) {
					if (oErr.statusCode === "403") MessageBox.error("No authorization to access Mail Roles.");
					this.getView().setModel(new JSONModel([]), "MailRoles");
					this.getView().byId("btnAddRole").setEnabled(false);
					this._oTable.setBusy(false);
					this.getView().setBusy(false);
				}.bind(this)
			});
		},

		_getServiceTeamDataSet: function () {
			var oServiceTeamDropDownValues = this.getModel("serviceTeamDropDownValues").getData(),
				oValuePairs = {};

			oServiceTeamDropDownValues.forEach(function (item) {
				if (item.DropdownKey.startsWith("00")) oValuePairs[Number(item.DropdownKey).toString()] = item.DropdownValue; //no leading zeros
				else oValuePairs[item.DropdownKey] = item.DropdownValue;
			});

			return oValuePairs;
		},

		/**
		 * Read mail templates and store them in own model
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 */
		_readMailTemplates: function () {
			this._AdminModel.read("/MailTemplatesAdminApp", {
				filters: [new Filter({ filters: [new Filter("TemplateType", "Contains", "Mail"), new Filter("profile", "NE", "unassigned"), new Filter("profile", "NE", "mcs-L1ccm")], and: true })],
				success: function (oData) {
					if (!this.getModel("EmailTemplates")) {
						this.getView().setModel(new JSONModel([]), "EmailTemplates");
					}
					this.getModel("EmailTemplates").setData(oData.results);
					this.getModel("EmailTemplates").refresh();
				}.bind(this)
			});

			/*	this._AdminModel.read("/MailTemplates", {
					success: function (oData) {
						if (!this.getModel("AllMailTemplates")) {
							this.getView().setModel(new JSONModel([]), "AllMailTemplates");
						}
						this.getModel("AllMailTemplates").setData(oData.results);
						this.getModel("AllMailTemplates").refresh();
					}.bind(this)
				});*/
		},

		/**
		 * Read region help and store them in own model
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 */
		_readRegionHelp: function () {
			this._oODataModel.read("/RegionHelp", {
				success: function (oData) {
					if (!this.getModel("RegionHelp")) {
						this.getView().setModel(new JSONModel([]), "RegionHelp");
					}
					this.getView().getModel("RegionHelp").setData(oData.results);
					this.getView().setModel(new JSONModel(oData.results), "RegionHelpFiltered");
					this.getView().getModel("RegionHelp").refresh();
				}.bind(this)
			});
		},

		_readServiceTeamHelp: function () {
			var aFilters = [new Filter("DropdownName", FilterOperator.EQ, "MailRoles-ServiceTeam-Dropdown"),
			new Filter("ProfileName", FilterOperator.EQ, "Default")
			];

			var dropdown = this._readDropDownValues(aFilters);

			dropdown.then(function (aDropDownValues) {
				// sort the values with dropdownvalue field
				aDropDownValues = aDropDownValues.sort(function (a, b) {
					if (a.DropdownValue < b.DropdownValue) {
						return -1;
					}
					if (b.DropdownValue < a.DropdownValue) {
						return 1;
					}
					return 0;
				});

				this.setModel(new JSONModel(aDropDownValues), "serviceTeamDropDownValues");

				this._readMailRoles();

			}.bind(this)).catch(function (e) {
				this.getModel("serviceTeamDropDownValues").setData([]);
			}.bind(this));
		},

		_readEngagementTypeHelp: function () {
			var aFilters = [new Filter("DropdownName", FilterOperator.EQ, "Case-EngagementType-Dropdown"),
			new Filter("DropdownName", FilterOperator.EQ, "Case-EngagementType-GEM-Dropdown")
			];

			var dropdown = this._readDropDownValues(aFilters);

			dropdown.then(function (aDropDownValues) {
				// sort the values with dropdownvalue field
				aDropDownValues = aDropDownValues.sort(function (a, b) {
					if (a.DropdownValue < b.DropdownValue) {
						return -1;
					}
					if (b.DropdownValue < a.DropdownValue) {
						return 1;
					}
					return 0;
				});

				aDropDownValues.forEach(function (aDropDownValue) {
					if (aDropDownValue.DropdownName === 'Case-EngagementType-GEM-Dropdown') {
						aDropDownValue.DropdownValue = aDropDownValue.DropdownValue + ' (GEM)';
						aDropDownValue.DropdownName = 'Engagement Type (GEM)';
					} else {
						aDropDownValue.DropdownName = 'Engagement Type';
					}
				});

				this.setModel(new JSONModel(aDropDownValues), "EngagementTypeDropDownValues");

			}.bind(this)).catch(function (e) {
				this.getModel("EngagementTypeDropDownValues").setData([]);
			}.bind(this));
		},

		/**
		 * Read dropdown values help and store them in own model
		 * @memberOf mcc.workbench.admin.settings.view.List
		 * @private
		 */
		_readDropDownValues: function (oFilter) {
			return new Promise(function (resolve, reject) {
				this._oODataModel.read("/DropdownValues", {
					filters: oFilter,
					success: function (oData) {
						resolve(oData.results);
					},
					error: function (err) {
						reject(err);
					}
				});
			}.bind(this));
		},

		/**
		 * Counts the current number of entries and displays the number in the header
		 */
		_updateHeader: function () {
			var count = this._oTable.getBinding("rows").getLength();
			var sTitle = this.getResourceBundle().getText("mailRolesCount", count);
			this.getModel("masterView").setProperty("/title", sTitle);
		}
	});

});