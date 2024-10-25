sap.ui.define([
	"mcc/workbench/admin/settings/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"mcc/workbench/admin/settings/model/formatter"
], function (BaseController, JSONModel, FilterOperator, Filter, MessageBox, MessageToast, formatter) {
	"use strict";

	return BaseController.extend("mcc.workbench.admin.settings.controller.WorkforcePlanner.Main", {
		formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf mcc.workbench.admin.settings.controller.Misc.Solutions.List
		 */
		onInit: function () {
			this.getView().setModel(new JSONModel([]), "TeamMember");
			this.getView().byId("addMember").setEnabled(false);
		},

		onTeamChange: function (oEvent) {
			this.teamID = oEvent.getParameter("selectedItem").getKey();
			if (!window.location.href.includes("port5000")) {
				if (this.getView().getModel("teamCalendarModel").oMetadata.bFailed) this.getView().byId("msgISP").setVisible(true);
				else this.getView().byId("msgISP").setVisible(false);
				if (this.getView().getModel("teamCalendarModel").oMetadata.bFailed) this.getView().byId("addMember").setEnabled(false);
				else this.getView().byId("addMember").setEnabled(true);
			} else this.getView().byId("addMember").setEnabled(true); // DEV
			this._loadTeamMembers();
		},

		_loadTeamMembers: function () {
			var oModel = this.getView().getModel("AdminApp");
			// role check on service side, only teams returned where the user has admin role
			oModel.read("/Teams", {
				filters: [new Filter("teamID", "EQ", this.teamID)],
				urlParameters: "$expand=teamMembers,teamMembers/user",
				success: function (oData) {
					oData.results[0].teamMembers.results.forEach(function (item) {
						item.bEdit = false;
					});
					this.getView().getModel("TeamMember").setData(oData.results[0].teamMembers.results);
					this.getView().getModel("TeamMember").updateBindings(true);
				}.bind(this),
				error: function (err) {
					this.getView().getModel("TeamMember").setData([]);
				}.bind(this)
			});
		},

		onDelete: function (oEvent) {
			var row = oEvent.getSource().getParent().getParent();
			var sPath = row.getBindingContext("TeamMember").getPath();
			var oModel = this.getView().getModel("AdminApp");
			var object = this.getView().getModel("TeamMember").getProperty(sPath);
			//delete team member
			oModel.remove("/TeamMembers(user_userID='" + object.user_userID + "',team_teamID=guid'" + object.team_teamID + "')", {
				success: function () {
					//if user is only assigned to this team -> delete user as well
					//it user is assigned to multiple teams -> can't delete user
					oModel.read("/TeamMembers", {
						filters: [new Filter("user_userID", "EQ", object.user_userID)],
						success: function (oData) {
							if (oData.results.length === 0) oModel.remove("/Users('" + object.user_userID + "')");
							this._loadTeamMembers();
						}.bind(this),
						error: function (err) { }
					});
					MessageToast.show("User deleted.");
				}.bind(this),
				error: function (err) {
					MessageBox.error("An error occured while deleting the team member.");
				}
			});
		},

		onAddPress: function () {
			this.oNewMember = this.getView().getModel("AdminApp").createEntry("/TeamMembers", {
				properties: {
					user_userID: "",
					team_teamID: this.teamID
				}
			});
			this.oNewUser = this.getView().getModel("AdminApp").createEntry("/Users", {
				properties: {
					userID: "",
					ISPuserID: "",
					name: "",
					email: ""
				}
			});
			if (!this.createDialog) {
				this.createDialog = sap.ui.xmlfragment(this.getView().getId(),
					"mcc.workbench.admin.settings.view.WorkforcePlanner.CreateUser", this);
				this.oView.addDependent(this.createDialog);
			}
			this.createDialog.setBindingContext(this.oNewUser);//set name in UI
			this.getView().byId("selectedUser").setValue("");
			this.getView().byId("dateFrom").setValue(null);
			this.getView().byId("dateTo").setValue(null);
			this.createDialog.open();
		},

		onEmployeeSelected: function (oEvent) {
			var oSelectedItem = oEvent.getParameter("selectedItem");
			var user = oSelectedItem.getBindingContext("employees").getModel().getProperty(oSelectedItem.getBindingContext("employees").getPath());

			var sUserId = user.ID,
				sUserName = user.lastName + ", " + user.firstName,
				sEmail = user.email;
			this.getView().getModel("AdminApp").setProperty(this.oNewUser + "/userID", sUserId);
			this.getView().getModel("AdminApp").setProperty(this.oNewUser + "/name", sUserName);
			this.getView().getModel("AdminApp").setProperty(this.oNewUser + "/email", sEmail);
			this.getView().getModel("AdminApp").setProperty(this.oNewMember + "/user_userID", sUserId);
			//set name in UI
			this.getView().byId("selectedUser").setValue(sUserName);

			//get ISP User ID
			var oTeamCalendarModel = this.getView().getModel("teamCalendarModel");
			oTeamCalendarModel.read("/SearchResultSet", {
				urlParameters: {
					"search": sUserId
				},
				success: function (oData) {
					if (oData.results.length === 1) {
						this.getView().byId("createMember").setEnabled(true);
						this.getView().getModel("AdminApp").setProperty(this.oNewUser + "/ISPuserID", oData.results[0].EmployeeId);
					} else if (oData.results.length === 0) {
						this.getView().byId("createMember").setEnabled(false);
						MessageBox.error("No ISP user data found.");
					} else if (oData.results.length > 1) { //sometimes multiple results are returned
						oData.results.forEach(function (user1) {
							if (user1.Name.includes(user.lastName) && user1.Name.includes(user.firstName)) {
								this.getView().byId("createMember").setEnabled(true);
								this.getView().getModel("AdminApp").setProperty(this.oNewUser + "/ISPuserID", user1.EmployeeId);
							}
						}.bind(this));
					}
				}.bind(this),
				error: function (err) {
					this.getView().byId("createMember").setEnabled(false);
					MessageBox.error("An error occured while loading user data.");
				}.bind(this)
			});
			this.onEmployeeDialogClose(oEvent);
		},

		setDateFrom: function (oEvent) {
			this.getView().getModel("AdminApp").setProperty(this.oNewMember + "/validFrom", oEvent.getSource().getDateValue());
			if (!this.getView().getModel("AdminApp").getProperty(this.oNewMember + "/validTo")) {
				this.getView().byId("createMember").setEnabled(false);
				this.getView().byId("dateTo").setValueState("Error");
			}
			else {
				if (this.getView().getModel("AdminApp").getProperty(this.oNewUser + "/ISPuserID")) this.getView().byId("createMember").setEnabled(true);
				this.getView().byId("dateTo").setValueState("None");
			}
			this.getView().byId("dateFrom").setValueState("None");
		},
		setDateTo: function (oEvent) {
			this.getView().getModel("AdminApp").setProperty(this.oNewMember + "/validTo", oEvent.getSource().getDateValue());
			if (!this.getView().getModel("AdminApp").getProperty(this.oNewMember + "/validFrom")) {
				this.getView().byId("createMember").setEnabled(false);
				this.getView().byId("dateFrom").setValueState("Error");
			}
			else {
				if (this.getView().getModel("AdminApp").getProperty(this.oNewUser + "/ISPuserID")) this.getView().byId("createMember").setEnabled(true);
				this.getView().byId("dateFrom").setValueState("None");
			}
			this.getView().byId("dateTo").setValueState("None");
		},

		onCreate: function (oEvent) {
			var oModel = this.getView().getModel("AdminApp");
			oModel.attachEvent("batchRequestCompleted", function (evt) {
				if (this._checkIfBatchRequestSucceeded(evt)) {
					if (evt.getParameter("requests")[0].method === "POST") {
						this._loadTeamMembers();
						MessageToast.show("User created");
						this._afterCreate();
						this.createDialog.close();
					}
				} else {
					//keep create dialog open
					MessageBox.error("An error occured while creating the user entry.");
				}
			}.bind(this));

			//check if user already exists - if yes only create team member entry
			oModel.read("/Users", {
				filters: [new Filter("userID", "EQ", oModel.getProperty(this.oNewUser + "/userID"))],
				success: function (oData) {
					if (oData.results.length > 0) {
						oModel.deleteCreatedEntry(this.oNewUser);
					}
					oModel.submitChanges();
				}.bind(this),
				error: function (err) {
					//keep create dialog open
					MessageBox.error("An error occured while creating the user entry.");
				}
			});
		},

		_checkIfBatchRequestSucceeded: function (oEvent) {
			var oParams = oEvent.getParameters();
			var aRequests = oEvent.getParameters().requests;
			var oRequest;
			if (oParams.success) {
				if (aRequests) {
					for (var i = 0; i < aRequests.length; i++) {
						oRequest = oEvent.getParameters().requests[i];
						if (!oRequest.success) return false;
					}
				}
				return true;
			} else return false;
		},

		onCancel: function (oEvent) {
			this.getView().getModel("AdminApp").deleteCreatedEntry(this.oNewUser);
			this.getView().getModel("AdminApp").deleteCreatedEntry(this.oNewMember);
			this.getView().getModel("AdminApp").resetChanges();
			this._afterCreate();
			this.createDialog.close();
		},

		_afterCreate: function () {
			this.oNewUser = undefined;
			this.oNewMember = undefined;
			this.oBindingContext = undefined;
		},

		onEdit: function (oEvent) {
			var path = oEvent.getParameter("row").getBindingContext("TeamMember").getPath();
			this.getView().getModel("TeamMember").setProperty(path + "/bEdit", true);
		},
		onDateChange: function (oEvent) {
			var path = oEvent.getSource().getBindingContext("TeamMember").getPath();
			var property = oEvent.getSource().getBindingInfo("value").binding.getPath();
			this.getView().getModel("TeamMember").setProperty(path + "/" + property, oEvent.getSource().getDateValue());
		},
		onSave: function (oEvent) {
			var oModel = this.getView().getModel("AdminApp");
			var path = oEvent.getParameter("row").getBindingContext("TeamMember").getPath();
			var teamMember = this.getView().getModel("TeamMember").getProperty(path);

			var data = {
				validFrom: teamMember.validFrom ? teamMember.validFrom : null,
				validTo: teamMember.validTo ? teamMember.validTo : null
			};
			oModel.update("/TeamMembers(user_userID='" + teamMember.user_userID + "',team_teamID=guid'" + teamMember.team_teamID + "')", data, {
				success: function () {
					this.getView().getModel("TeamMember").setProperty(path + "/bEdit", false);
				}.bind(this),
				error: function (err) {
					new MessageBox.error("An error occured while saving a team member.");
				}
			});
		},
		onCancelSave: function (oEvent) {
			var oModel = this.getView().getModel("AdminApp");
			var path = oEvent.getParameter("row").getBindingContext("TeamMember").getPath();
			var teamMember = this.getView().getModel("TeamMember").getProperty(path);
			oModel.read("/TeamMembers(user_userID='" + teamMember.user_userID + "',team_teamID=guid'" + teamMember.team_teamID + "')", {
				urlParameters: "$expand=user",
				success: function (oData) {
					this.getView().getModel("TeamMember").setProperty(path, oData);
					this.getView().getModel("TeamMember").setProperty(path + "/bEdit", false);
					this.getView().getModel("TeamMember").updateBindings(true);
				}.bind(this)
			});
		}
	});
});