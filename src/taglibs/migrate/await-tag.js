const printJS = require("./util/printJS");

module.exports = function migrator(elNode, context) {
    const builder = context.builder;
    const argument = elNode.argument;
    elNode.argument = undefined;

    if (argument) {
        context.deprecate(
            'The "<await(result from promise)>" syntax has been deprecated, please use the modern syntax of "<await(promise)><@then|result|>". See: https://github.com/marko-js/marko/wiki/Deprecation:-async-tag'
        );
    }

    const match = /^([$A-Z_][0-9A-Z_$]*) from (.*)$/i.exec(argument);

    if (!match) {
        context.addError(
            "Invalid <await> tag. Argument is malformed. Example: <await(user from data.userProvider)>"
        );
        return;
    }

    const varName = match[1];
    const dataProvider = match[2];
    const thenNode = builder.htmlElement("@then");
    thenNode.params = [varName];

    let placeholderBody;
    let timeoutBody;
    let errorBody;

    if (elNode.hasAttribute("placeholder")) {
        context.deprecate(
            'The "placeholder" attribute on the "<await>" tag is deprecated. Please use the "<@placeholder>" nested tag instead.'
        );

        placeholderBody = [
            builder.text(elNode.getAttributeValue("placeholder"))
        ];
        elNode.removeAttribute("placeholder");
    }

    if (elNode.hasAttribute("timeout-message")) {
        context.deprecate(
            'The "timeout-message" attribute on the "<await>" tag is deprecated. Please use the "<@catch|err|>" nested tag instead with a check for "err.name === "TimeoutError".'
        );

        timeoutBody = [
            builder.text(elNode.getAttributeValue("timeout-message"))
        ];
        elNode.removeAttribute("timeout-message");
    }

    if (elNode.hasAttribute("error-message")) {
        context.deprecate(
            'The "error-message" attribute on the "<await>" tag is deprecated. Please use the "<@catch>" nested tag instead.'
        );
        errorBody = [builder.text(elNode.getAttributeValue("error-message"))];
        elNode.removeAttribute("error-message");
    }

    elNode.forEachChild(childNode => {
        if (childNode.type !== "HtmlElement") {
            return;
        }

        switch (childNode.tagName) {
            case "await-placeholder":
                placeholderBody = childNode.body;
                break;
            case "await-timeout":
                timeoutBody = childNode.body;
                break;
            case "await-error":
                errorBody = childNode.body;
                break;
            default:
                return;
        }

        childNode.detach();
    });

    elNode.argument = dataProvider;
    elNode.moveChildrenTo(thenNode);

    const renderPlaceholderAttr = elNode.getAttributeValue("renderPlaceholder");
    const renderTimeoutAttr = elNode.getAttributeValue("renderTimeout");
    const renderErrorAttr = elNode.getAttributeValue("renderError");
    elNode.removeAttribute("renderPlaceholder");
    elNode.removeAttribute("renderTimeout");
    elNode.removeAttribute("renderError");

    if (renderPlaceholderAttr && !placeholderBody) {
        context.deprecate(
            'The "renderPlaceholder" attribute on the "<await>" tag is deprecated and will be removed in a future version of Marko.'
        );
        placeholderBody = [buildDynamicTag(renderPlaceholderAttr, context)];
    }

    if (renderTimeoutAttr && !timeoutBody) {
        context.deprecate(
            'The "renderTimeout" attribute on the "<await>" tag is deprecated and will be removed in a future version of Marko.'
        );
        timeoutBody = [buildDynamicTag(renderTimeoutAttr, context)];
    }

    if (renderErrorAttr && !errorBody) {
        context.deprecate(
            'The "renderError" attribute on the "<await>" tag is deprecated and will be removed in a future version of Marko.'
        );
        errorBody = [buildDynamicTag(renderErrorAttr, context)];
    }

    if (placeholderBody) {
        elNode.appendChild(
            builder.htmlElement("@placeholder", undefined, placeholderBody)
        );
    }

    elNode.appendChild(thenNode);

    if (timeoutBody) {
        const originalErrorBody = errorBody;
        errorBody = [
            builder.htmlElement(
                "if",
                undefined,
                timeoutBody,
                'err.name === "TimeoutError"'
            )
        ];

        if (originalErrorBody) {
            errorBody.push(
                builder.htmlElement("else", undefined, originalErrorBody)
            );
        }
    }

    if (errorBody) {
        const catchNode = builder.htmlElement("@catch", undefined, errorBody);
        if (timeoutBody) {
            catchNode.params = ["err"];
        }

        elNode.appendChild(catchNode);
    }
};

function buildDynamicTag(expression, context) {
    const node = context.builder.htmlElement();
    node.rawTagNameExpression = printJS(expression, context);
    return node;
}
