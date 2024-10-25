sap.ui.define([
    "mcc/workbench/admin/settings/controller/BaseController",
    "mcc/workbench/admin/settings/model/formatter",
    'sap/f/library'
], function (BaseController, formatter, fioriLibrary) {
    "use strict";

    return BaseController.extend("mcc.workbench.admin.settings.controller.AIScenario.Detail", {
        formatter: formatter,
        onInit: function () {

        },

        navToAIManager: function () {
            this.getRouter().navTo("AIManager");
        },

        handleClose: function () {
            var oFCL = this.oView.getParent().getParent();
            oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);
        },

        formatRowSettings: function (sValue) {
            if (sValue === true) {
                return "Information";
            }
            return "None";
        },

        formatProcessed: function (bProcessed) {
            return !!bProcessed;
        },

        onSort: function (oEvent) {
            var oTable = this.getView().byId("feedbackTable");
            var oBinding = oTable.getBinding("rows");
            var sOrderby = oBinding.mParameters.$orderby;
            var bDescending = sOrderby.endsWith(' desc');
            var sNewOrderby = bDescending ? 'createdAt' : 'createdAt desc';
            oBinding.changeParameters({
                '$orderby': sNewOrderby
            });
        },

        onNavigate: function (oEvent) {
            const oSelectedItem = oEvent.getSource().getBindingContext("MCCAIManagerService");
            const oSelectedData = oSelectedItem.getObject();
            const oResponseID = oSelectedData.responseID_responseID;
            const bProcessed = oSelectedData.processed;
            const olocalModel = this.getModel("local");
            const oModel = this.getOwnerComponent().getModel("MCCAIManagerService");

            olocalModel.setProperty("/processedFlag", bProcessed);

            const requestBindingValue = (oModel, sPath, sProperty, oLocalModel) => {
                const oBinding = oModel.bindProperty(sPath);
                oBinding.requestValue()
                    .then(value => {
                        oLocalModel.setProperty(sProperty, value);
                    })
                    .catch(error => {
                        console.error(`Error requesting value for path ${sPath}:`, error);
                    });
            };

            requestBindingValue(oModel, `/AIResponseTracking('${oResponseID}')/response`, "/gptResponseMessage", olocalModel);
            requestBindingValue(oModel, `/AIResponseTracking('${oResponseID}')/dataID`, "/dataID", olocalModel);

            const oFCL = this.oView.getParent().getParent();
            oFCL.setLayout(fioriLibrary.LayoutType.ThreeColumnsEndExpanded);

            oFCL.getAggregation("endColumnPages")[0].bindElement({
                path: `/AIFeedback('${oSelectedData.feedbackID}')`,
                model: "MCCAIManagerService",
            });
        }
    });
});