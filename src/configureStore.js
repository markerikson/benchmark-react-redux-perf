import {applyMiddleware, compose, createStore} from 'redux'

import rootReducer from './pairsReducer'

export default function configureStore(preloadedState) {
    const middlewares = []
    const middlewareEnhancer = applyMiddleware(...middlewares)

    const enhancers = [middlewareEnhancer]
    const composedEnhancers = compose(...enhancers)

    const store = createStore(rootReducer, preloadedState, composedEnhancers)

    return store
}