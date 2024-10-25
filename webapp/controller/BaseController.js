/*global history */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast"

], function (Controller, History, JSONModel, FilterOperator, Filter, MessageBox, MessageToast) {
	"use strict";

	return Controller.extend("mcc.workbench.admin.settings.controller.BaseController", {

		/**
		 * Convenience method for accessing the router in every controller of the application.
		 * @public
		 * @returns {sap.ui.core.routing.Router} the router for this component
		 */
		getRouter: function () {
			return this.getOwnerComponent().getRouter();
		},

		/**
		 * Convenience method for getting the view model by name in every controller of the application.
		 * @public
		 * @param {string} sName the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function (sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model in every controller of the application.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Convenience method for getting the resource bundle.
		 * @public
		 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
		 */
		getResourceBundle: function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/**
		 * Event handler  for navigating back.
		 * If not, it will replace the current entry of the browser history with the home route.
		 * @public
		 */
		onNavBack: function (oEvent) {
			var oHistory = sap.ui.core.routing.History.getInstance(),
				sPreviousHash = oHistory.getPreviousHash();

			if (sPreviousHash !== undefined) {
				// The history contains a previous entry
				history.go(-1);
			} else {
				this.getRouter().navTo("home", {}, true);
			}
		},

		//*** start of employee dialog functions***//

		onOpenUserSearchDialog: function () {
			var dialog = sap.ui.xmlfragment(this.oView.getId(),
				"mcc.workbench.admin.settings.const.customEmployeeSearch", this);
			this.oView.addDependent(dialog);
			dialog.open();
		},

		onEmployeeSearch: function (oEvent) {
            var value = oEvent.getParameter("value");
            jQuery.ajax({
                url: sap.ui.require.toUrl("mcc/workbench/admin/settings") + "/sapit-employee-data/Employees?$search=" + value + "&$top=50",
                async: false,
                method: "GET",
                dataType: 'json',
                success: function (oUserData) {
                    this.getView().byId("employeeSearchDialog").setModel(new JSONModel(oUserData.value), "employees");
                }.bind(this),
                error: function () {
                    this.getView().byId("employeeSearchDialog").setModel(new JSONModel([]), "employees");
                }.bind(this)
            });
        },
		onEmployeeDialogClose: function (oEvent) {
            oEvent.getSource().destroy();
        },

		//*** start of product dialog functions***//

		loadProductLine: function (that) {
			var oModel = that._ZS_APP_DEP_Model;
			return new Promise(function (resolve, reject) {
				oModel.read("/ProductLineSet", {
					urlParameters: {
						"$top": 9999
					},
					success: function (oData) {
						oData.results = oData.results.sort(function (a, b) {
							if (a.LineName < b.LineName) {
								return -1;
							}
							if (b.LineName < a.LineName) {
								return 1;
							}
							return 0;
						});
						var oProductLineModel = new JSONModel();
						oProductLineModel.setData(oData.results);
						that.getView().setModel(oProductLineModel, "ProductLines");
						resolve();
					},
					error: function (err) {
						that.getView().setModel(new JSONModel([]), "ProductLines");
						resolve();
					}
				});
			});
		},

		loadAllProducts: function (that) {
			return new Promise(function (resolve, reject) {
				var oModel = that._ZS_APP_DEP_Model;
				oModel.read("/ProductSet", {
					urlParameters: {
						"$top": 10000
					},
					success: function (oData) {
						oData.results = oData.results.sort(function (a, b) {
							if (a.ProductName < b.ProductName) {
								return -1;
							}
							if (b.ProductName < a.ProductName) {
								return 1;
							}
							return 0;
						});
						that.getView().setModel(new JSONModel(oData.results), "Products");
						that.getView().setModel(new JSONModel(oData.results), "AllProducts");
						resolve();
					},
					error: function (err) {
						that.getView().setModel(new JSONModel([]), "Products");
						that.getView().setModel(new JSONModel([]), "AllProducts");
						resolve();
					}
				});
			});
		},

		onSwitchChange: function (oEvent, sProperty) {
			var oNewState = oEvent.getParameter("state");
			var sPath = oEvent.getSource().getBindingContext("MCCToolSuite").sPath + '/' + sProperty;
			this._oModel.setProperty(sPath, oNewState);
			this._oModel.submitChanges();

		},

		stageItemForRemoval: function (sPath) {
			var oModel = this._oModel;
			oModel.remove(sPath);
		},

		onTypeChange: function (oEvent, allowedFilterCriteria) {
			this.getView().byId("createButton").setEnabled(true);
			if (!allowedFilterCriteria)
				var allowedFilterCriteria = this.getView().getModel("MCCToolSuite").getProperty(oEvent.getParameter("selectedItem").getBindingContext("MCCToolSuite").sPath).allowedFilterCriteria;
			if (allowedFilterCriteria && allowedFilterCriteria.includes("notification_customer_id")) {
				this.getView().byId("FlexBoxCustomer").setVisible(true);
				this.getView().byId("segmentedButtonCustomer").setVisible(true);
			}
			else {
				this.getView().byId("FlexBoxCustomer").setVisible(false);
				this.getView().byId("segmentedButtonCustomer").setVisible(false);
				this.getView().byId("InputCustomer").setValue("");

			}
			if (allowedFilterCriteria && allowedFilterCriteria.includes("notification_service_team_id")) {
				this.getView().byId("ServiceTeams_ComboBox").setVisible(true);
			}
			else {
				this.getView().byId("ServiceTeams_ComboBox").setVisible(false);
				this.getView().byId("ServiceTeams_ComboBox").setSelectedKeys([]);
			}

		},

		loadProducts: function (that, index) {
			return new Promise(function (resolve, reject) {
				var lineId = that.getView().getModel("ProductLines").getData()[index].LineID;
				var oModel = that._ZS_APP_DEP_Model;
				if (!lineId) {
					that.getView().setModel(new JSONModel([]), "Products");
					resolve();
					return;
				}
				oModel.read("/ProductLineSet('" + lineId + "')/toProduct", {
					success: function (oData) {
						oData.results = oData.results.sort(function (a, b) {
							if (a.ProductName < b.ProductName) {
								return -1;
							}
							if (b.ProductName < a.ProductName) {
								return 1;
							}
							return 0;
						});
						that.getView().setModel(new JSONModel(oData.results), "Products");
						resolve();
					},
					error: function (err) {
						that.getView().setModel(new JSONModel([]), "Products");
						resolve();
					}
				});
			});
		},
		onSearchLine: function (oEvent) {
			// add filter for search
			var aFilters = [];
			var sQuery = oEvent.getSource().getValue();
			if (sQuery && sQuery.length > 0) {
				var filter = new Filter("LineName", sap.ui.model.FilterOperator.Contains, sQuery);
				aFilters.push(filter);
			}

			// update list binding
			var oList = this.oView.byId("listProductLines");
			var oBinding = oList.getBinding("items");
			oBinding.filter(aFilters, "Application");
		},

		onSearchProduct: function (oEvent) {
			// add filter for search
			var aFilters = [];
			var sQuery = oEvent.getSource().getValue();
			if (sQuery && sQuery.length > 0) {
				var filter = new Filter("ProductName", sap.ui.model.FilterOperator.Contains, sQuery);
				aFilters.push(filter);
			}

			// update list binding
			var oList = this.oView.byId("listProducts");
			var oBinding = oList.getBinding("items");
			oBinding.filter(aFilters, "Application");
		},
		onTabBarSelected: function (oEvent) {
			var that = this;
			var navCon = this.oView.byId("navContainer");
			this.oSolutionDialog.setBusy(true);
			if (oEvent.getParameter("selectedKey") === "line") {
				this.oView.byId("buttonAdd").setEnabled(false);
				navCon.to(this.oView.byId("selectProductLine"), "slide");
				this.oSolutionDialog.setBusy(false);
			} else if (oEvent.getParameter("selectedKey") === "product") {
				this.oView.byId("buttonAdd").setEnabled(false);
				var load = that.loadAllProducts(that);
				load.then(function () {
					that.oSolutionDialog.setBusy(false);
					navCon.to(that.oView.byId("selectProduct"), "slide");
				});
			}

			if (oEvent.getSource().getId().indexOf("line") > -1) {
				oEvent.getSource().setSelectedKey("line");
			} else if (oEvent.getSource().getId().indexOf("product") > -1) {
				oEvent.getSource().setSelectedKey("product");
			}
		},
		handleNavNext: function (oEvent) {
			this.oSolutionDialog.setBusy(true);
			var that = this;
			var navCon = this.oView.byId("navContainer");
			var listItemIndex = oEvent.getSource().getBindingContextPath().substring(1);
			if (navCon.getCurrentPage().getId().indexOf("selectProductLine") > -1) {
				var load = that.loadProducts(this, listItemIndex);
				load.then(function () {
					that.oSolutionDialog.setBusy(false);
					navCon.to(that.oView.byId("selectProduct"), "slide");
				});
			}
		},

		onSelectProduct: function () {
			this.oView.byId("buttonAdd").setEnabled(true);
		},

		handleNavBack: function (oEvent) {
			var navCon = this.oView.byId("navContainer");
			if (navCon.getCurrentPage().getId() !== "selectProductVersion") {
				this.oView.byId("buttonAdd").setEnabled(false);
			}
			navCon.back();
		},

		getAppIdentifier: function () {

			return "FkAbP4ZrSF3gjOiI2Na2XxfpMpcsXC6r";
		},

		handleCancel: function () {
			this.oSolutionDialog.close();
		},



		_sortCustomerData: function (oData) {
			var iacValues = ["1", "8", "9", "G", "V", "I"];
			var aData = [...new Map(oData.results.map(item => [item["Customer_No"], item])).values()];
			var aResults = [];
			for (var i = 0; i < aData.length; i++) {
				var IsGlobalUltimate = aData[i].Customer_No === aData[i].Global_Ultimate_No
				aResults.push({
					//"ID": aData[i].Customer_No,
					"CustomerNo": aData[i].Customer_No, //ErpCustNo,
					"CustomerName": aData[i].Customer_Name,
					"Global_Ultimate_No": aData[i].Global_Ultimate_No,
					"Partner": aData[i].Customer_BP,
					"IsGlobalUltimate": IsGlobalUltimate,
					//	"Iac": aData[i].IAC,
					Iac: iacValues.indexOf(aData[i].IAC) > -1 ? aData[i].IAC : "ZZZZZ",
					"filterProp": IsGlobalUltimate ? "Global Ultimate" : "Customer",
					"description": "(BP: " + aData[i].Customer_BP + ", ERP: " + aData[i].Customer_No + ") - " + aData[i].Country_Name

				});
			}
			iacValues.push("ZZZZZ");
			aResults = aResults.sort(function (a, b) { //replace with aResults adata
				if (iacValues.indexOf(a.Iac) < iacValues.indexOf(b.Iac)) {
					return -1;
				} else if (iacValues.indexOf(a.Iac) > iacValues.indexOf(b.Iac)) {
					return 1;
				} else if (b.filterProp < a.filterProp) {
					return -1;
				} else if (b.filterProp > a.filterProp) {
					return 1;
				} else if (b.CustomerName > a.CustomerName) {
					return -1;
				} else if (b.CustomerName < a.CustomerName) {
					return 1;
				} else if (b.description > a.description) {
					return -1;
				} else if (b.description < a.description) {
					return 1;
				}
				return 0;
			}.bind(this));
			for (var i = 0; i < aResults.length; i++) {
				if (i === 0) {
					aResults[i].isTopMatch = true;
				} else if ((i === 1 || i === 2) && aResults[i].iac !== "ZZZZZ") {
					aResults[i].isTopMatch = true;
				} else if (i > 2 && i < 5 && aResults[i].iac !== "ZZZZZ" && aResults[i].iac === aResults[(i - 1)].iac) {
					aResults[i].isTopMatch = true;
				} else {
					aResults[i].isTopMatch = false;
				}
			}
			return aResults;
		},
		onCancel: function (oEvent) {
			var oModel = this._oModel;
			oEvent.getSource().getParent().close();
			oEvent.getSource().getParent().destroy();
			oModel.resetChanges();
		},

		onResetCustomer: function () {
			this.getView().byId("InputCustomer").setValue("");
		},

		onSearch: function (oEvent) {
			var sValue = oEvent.getParameter("query").trimStart();
			var oList = this.getView().byId("idCustomer");
			var that = this;
			oList.setBusy(true);
			this.searchCustomers(sValue).then(
				function (aResults) {
			 var sType= that.getView().getModel("searchResult").getProperty("/searchType");

			 if(sType == "GlobalUltimate") {
				aResults =	aResults.filter(function(item) {
					return item.IsGlobalUltimate === true;
				});
			 }
					//success
					that.getModel("searchResult").setProperty("/Customer", {
						"results": aResults,
						"count": aResults.length,
						"expanded": aResults.length ? true : false
					});
				},
				function (error) {
					sap.m.MessageToast.show("CustomerInfoSet Service Unavailable!");
				}
			).finally(function () {
				oList.setBusy(false);
			});
		},

		handleRowPress: function (oEvent) {
			var sType= this.getView().getModel("searchResult").getProperty("/searchType");
			var sCurrentValue = this.getView().byId("InputCustomer").getValue();
			var oCustomerData = this.getView().getModel("searchResult").getProperty(oEvent.getSource().getBindingContext("searchResult").sPath);

			if(sType == "GlobalUltimate") {
				if(sCurrentValue.includes(oCustomerData.Global_Ultimate_No)) {
					MessageBox.error("Global_Ultimate_No "+ oCustomerData.Global_Ultimate_No + " already exists in your filter.");
					return;
				}
				var sCustomer = oCustomerData.CustomerName + " (GU: " + oCustomerData.Global_Ultimate_No + ")";
			}
			else {
				if(sCurrentValue.includes(oCustomerData.CustomerNo)) {
					MessageBox.error("CustomerNo "+ oCustomerData.CustomerNo + " already exists in your filter.");
					return;
				}
				var sCustomer = oCustomerData.CustomerName + " (ERPNo: " + oCustomerData.CustomerNo + ")";
			}

			
			if (sCurrentValue != "" ) {
				sCustomer = sCurrentValue + ", " + sCustomer;
			}
			this.getView().byId("InputCustomer").setValue(sCustomer);
			oEvent.getSource().getParent().getParent().close();
			oEvent.getSource().getParent().getParent().destroy();
		},


		triggerGlobalUltimatePersistence: function (sCustomers) {
			var oModel = this.getView().getModel("MCCToolSuite");

			var aCustomers = sCustomers.match(/\((\d+)\)/g).map(match => match.match(/\d+/)[0]);


			aCustomers.forEach(sCustomer => {
				oModel.callFunction("/persistCustomersForGlobalUltimate", {
					method: "POST",
					urlParameters: { GuErpNo: sCustomer },
					success: function() {
					},
					error: function(e) {
						MessageBox.error("Error occurred on trying to persist Global Ultimate");
					}
				});

			});

		},

		onValueHelpPress: function () {

			this.getModel("searchResult").setProperty("/Customer", {
						"count": "",
						"expanded": false,
						"results": []
				});
			if(this._oDialog)
			this._oDialog.destroy();
				this._oDialog = sap.ui.xmlfragment(this.getView().getId(),
				"mcc.workbench.admin.settings.view.ToolSuite.Notifications.SearchCustomer", this);
				this.oView.addDependent(this._oDialog);
			
 			this._oDialog.open();

		},

		searchCustomers: function (sValue) {
			this.getModel("searchResult").setProperty("/Customer", {
					"count": "",
					"expanded": false,
					"results": []
			});
			var promises = [];
			var that = this;
			var filters = [
				new Filter("Customer_BP", "EQ", sValue),
				new Filter("Customer_No", "EQ", sValue),
				new Filter("Customer_Name", "EQ", sValue),
			]
			filters.forEach(function (filter) {
				var oCustomerFilter = new Filter({
					filters: [
						new Filter("Accuracy", "EQ", "X"),
						filter
					],
					and: true
				});
				var promise = new Promise(function (resolve, reject) {
					that.getOwnerComponent().getModel("ZS_AGS_FSC2_SRV").read("/CustomerInfoSet", {
						filters: [oCustomerFilter],
						headers: {
							"AppIdentifier": "1XKRDt3vjcF7KMVMqB3QTudt96Z23rDO"
						},
						success: function (oData) {
							var aResults = that._sortCustomerData(oData);
							resolve(aResults);
						}.bind(that),
						error: function (err) {
							reject(err);
						}
					});
				}.bind(that))
				promises.push(promise);
			})
			return Promise.all(promises).then(function (values) {
				var results = Array.prototype.concat(...values);
				// console.log(results, "customer search results")
				return results;
			});

		},

		onDelete: function (oEvent) {
			var oModel = this._oModel;
			var sPath = oEvent.getSource().getParent().getBindingContext("MCCToolSuite").getDeepPath();
			MessageBox.show("Do you really want to delete this row?", {
				icon: MessageBox.Icon.WARNING,
				title: "Delete Row",
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						oModel.remove(sPath, {
							success: function () {
								MessageToast.show("Row deleted.");
							}.bind(this),
							error: function (err) {
								var oError = JSON.parse(err.responseText).error.message.value;
								MessageBox.error("An error occured while deleting the row: " + oError);
							}
						});
					}
				}
			});

		}
	});

});