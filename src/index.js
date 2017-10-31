export default function({types: t}){
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
                    ) && 
                    args.length === 2 &&
                    args[0].type === 'ArrayExpression' &&
                    args[1].type === 'FunctionExpression'
                ){
                    const deps = args[0].elements.map(element => element.value)
                    const definition = args[1]
                    const params = definition.params.map(param => param.name)

                    const program = path.findParent(path => path.isProgram())
                    // const program = path.getProgramParent()

                    program.node.body = definition.body.body

                    const requireStatements = buildRequireStatement(deps, params, this)
                    Array.prototype.unshift.apply(program.node.body, requireStatements)

                    program.node.body = program.node.body.map(item => {
                        if(item.type !== 'ReturnStatement'){
                            return item
                        }else{
                            return buildExportAST(item)
                        }
                    })
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
            return buildEmptyObjAST(param)
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

    function buildEmptyObjAST(param){
        return t.VariableDeclaration(
            "var",
            [
                t.VariableDeclarator(
                    t.Identifier(param),
                    t.ObjectExpression([])
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
                t.Identifier(ast.argument.name)
            )
        )
    }
}
