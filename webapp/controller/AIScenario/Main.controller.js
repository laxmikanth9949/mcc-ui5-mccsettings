sap.ui.define([
    "mcc/workbench/admin/settings/controller/BaseController",
    "mcc/workbench/admin/settings/model/formatter",
    'sap/f/library'
], function (BaseController, formatter, fioriLibrary) {
    "use strict";

    return BaseController.extend("mcc.workbench.admin.settings.controller.AIScenario.Main", {
        formatter: formatter,
        onInit: function () {
            const model = this.getOwnerComponent().getModel("MCCAIManagerService");
            const binding = model.bindList("/AIFeedback");

            binding.requestContexts()
                .then(contexts => {
                    // Extract the objects from the contexts
                    const objects = contexts.map(context => context.getObject());
                    // Create an array of unique scenarioIDs, converting to an array for further use
                    const uniqueScenarioIDs = [...new Set(objects.map(object => object.scenarioID_ID))];

                    // Calculate the average ratings for each unique scenario ID
                    const averageRatings = uniqueScenarioIDs.map(id => {
                        const relatedActions = objects.filter(({
                            scenarioID_ID
                        }) => scenarioID_ID === id);
                        const ratings = relatedActions.map(({
                            rating
                        }) => rating);
                        const sumRatings = ratings.reduce((a, b) => a + b, 0);
                        const averageRating = sumRatings / ratings.length;
                        return {
                            scenarioID_ID: id,
                            averageRating
                        };
                    });

                    const avgRatingsModel = new sap.ui.model.json.JSONModel();
                    avgRatingsModel.setData(averageRatings);

                    this.getView().setModel(avgRatingsModel, "avgRatingsModel");
                });
        },

        onSort: function (oEvent) {
            var oTable = this.getView().byId("ScenarioListTable");
            var oBinding = oTable.getBinding("rows");
            var sOrderby = oBinding.mParameters.$orderby;
            var bDescending = sOrderby.endsWith(' desc');
            oBinding.changeParameters({
                '$orderby': bDescending ? 'Description' : 'Description desc'
            });
        },

        handleClose: function () {
            var oFCL = this.oView.getParent().getParent();
            oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);
        },

        onNavigate: function (oEvent) {
            const oRowContext = oEvent.getSource().getBindingContext("MCCAIManagerService");
            const oData = oRowContext.getObject();
            const sDescription = oData.Description;
            const sScenarioId = oData.ID.toString();
            const oLocalModel = this.getModel("local");

            this.updateRatingsCount(sScenarioId, oLocalModel);
            this.setUserMessage(sScenarioId, oLocalModel);

            oLocalModel.setProperty("/detailHeaderTitle", sDescription);

            this.setLayout(sScenarioId);
        },

        updateRatingsCount: function (sScenarioId, oLocalModel) {
            const oModel = this.getOwnerComponent().getModel("MCCAIManagerService");
            const oBindingAIFeedback = oModel.bindList("/AIFeedback");
            oBindingAIFeedback.requestContexts()
                .then(aContexts => aContexts.map(oContext => oContext.getObject()))
                .then(aObjects => aObjects.filter(({
                    scenarioID_ID
                }) => scenarioID_ID === sScenarioId))
                .then(this.calculateRatingsCount)
                .then(aRatingsCount => oLocalModel.setProperty("/aRatingsCount", aRatingsCount));
        },

        setUserMessage: function (sScenarioId, oLocalModel) {
            const oModel = this.getOwnerComponent().getModel("MCCAIManagerService");
            const oBindingAIManagerScenario = oModel.bindList("/AIManagerScenario");
            oBindingAIManagerScenario.requestContexts()
                .then(aContexts => aContexts.map(oContext => oContext.getObject()))
                .then(aObjects => aObjects.filter(({
                    ID
                }) => ID === sScenarioId))
                .then(aFilteredObjects => {
                    const parameters = JSON.parse(aFilteredObjects[0].Parameters);
                    const messagesContent = parameters.messages[0].content;
                    oLocalModel.setProperty("/userMessage", messagesContent);
                });
        },

        calculateRatingsCount: function (aFilteredObjects) {
            const aRatingsCount = {
                "1": 0,
                "2": 0,
                "3": 0,
                "4": 0,
                "5": 0
            };
            aFilteredObjects.forEach(({
                rating
            }) => {
                const sRating = rating.toString();
                if (aRatingsCount.hasOwnProperty(sRating)) {
                    aRatingsCount[sRating]++;
                }
            });
            return aRatingsCount;
        },

        setLayout: function (sScenarioId) {
            const oFCL = this.oView.getParent().getParent();
            oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
            oFCL.getAggregation("midColumnPages")[0].byId("feedbackTable").bindElement({
                path: `/AIManagerScenario(${sScenarioId})`,
                model: "MCCAIManagerService",
            });
        }
    });
});