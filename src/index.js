export default function({types: t}){

    const emptyObj = t.ObjectExpression([])
    const emptyFunc = t.FunctionExpression(
        null,
        [],
        t.BlockStatement([])    
    )
    const emptyArray = t.ArrayExpression([])

    const emptyMap = {
        0: emptyObj,
        1: emptyObj,
        2: emptyFunc,
        3: emptyArray
    }

    return {
        visitor: {
            CallExpression(path){
                const callee = path.node.callee
                const args = path.node.arguments

                // define or NEJ.define
                if(
                    callee.name === 'define' ||
                    (
                        callee.type === 'MemberExpression' &&
                        callee.object.type === 'Identifier' &&
                        callee.object.name === 'NEJ' &&
                        callee.property.type === 'Identifier' &&
                        callee.property.name === 'define'
                    )
                ){
                    const program = path.findParent(path => path.isProgram())

                    /* define(function(){}) */
                    let definition, deps
                    if(args.length === 1 && args[0].type === 'FunctionExpression'){
                        definition = args[0]
                        deps = []
                    }

                    /* define([], function(){})*/
                    if(
                        args.length === 2 &&
                        args[0].type === 'ArrayExpression' &&
                        args[1].type === 'FunctionExpression'
                    ){
                        deps = args[0].elements.map(element => element.value)
                        definition = args[1]
                    }

                    const params = definition.params.map(param => param.name)

                    program.node.body = definition.body.body

                    const requireStatements = buildRequireStatement(deps, params, this)
                    Array.prototype.unshift.apply(program.node.body, requireStatements)

                    let noReturn = true

                    program.node.body = program.node.body.map(item => {
                        if(item.type !== 'ReturnStatement'){
                            return item
                        }else{
                            noReturn = false;
                            return buildExportAST(item)
                        }
                    })

                    if(noReturn){
                        // auto return
                        const name = params[deps.length]
                        program.node.body.push(buildExportAST(t.ReturnStatement(t.Identifier(name))))
                    }
                }
            }
        }
    }

    function transformDep(dep){
        return dep.replace(/\{(.+)\}\/?/, function(_, name){
            if(name === 'platform'){
                return './platform'
            }else{
                return `${name}/`
            }
        }).replace(/^text!/, '!!text!')
    }

    /*
        deps: ['./a.js']
        params: [a, _p]    
     */
    function buildRequireStatement(deps, params, context){
        var result = params.map((param, index) => {
            if(deps[index]){
                const dep = transformDep(deps[index])
                return buildRequireAST(dep, param, context)
            }
            return buildEmptyObjAST(param, index - deps.length)
        })

        return result
    }

    function buildRequireAST(dep, param, context){
        return t.VariableDeclaration(
            'var', 
            // [
            //     t.VariableDeclarator(
            //         t.Identifier(param),
            //         t.CallExpression(
            //             t.Identifier('require'),
            //             [
            //                 t.StringLiteral(dep)
            //             ]
            //         )
            //     )
            // ])
            [
                t.VariableDeclarator(
                    t.Identifier(param),
                    t.memberExpression(
                        t.CallExpression(
                            context.addHelper('interopRequireDefault'),
                            [
                                t.CallExpression(
                                    t.Identifier('require'),
                                    [
                                        t.StringLiteral(dep)
                                    ]
                                )
                            ]
                        ),
                        t.Identifier('default')
                    )
                )
            ]
        )
    }

    

    function buildEmptyObjAST(param, index){

        return t.VariableDeclaration(
            "var",
            [
                t.VariableDeclarator(
                    t.Identifier(param),
                    emptyMap[index]
                )
            ]
        )
    }

    function buildExportAST(ast){
        return t.ExpressionStatement(
            t.AssignmentExpression(
                '=',
                t.MemberExpression(
                    t.Identifier('module'),
                    t.Identifier('exports')
                ),
                ast.argument
            )
        )
    }
}
