import {getWindowFromNode} from './helpers'
import {eventMap, eventAliasMap} from './event-map'

function fireEvent(element, event) {
  if (!event) {
    throw new Error(`Unable to fire an event - please provide an event object.`)
  }
  if (!element) {
    throw new Error(
      `Unable to fire a "${event.type}" event - please provide a DOM element.`,
    )
  }
  return element.dispatchEvent(event)
}

const createEvent = {}

Object.keys(eventMap).forEach(key => {
  const {EventType, defaultInit} = eventMap[key]
  const eventName = key.toLowerCase()

  createEvent[key] = (node, init) => {
    if (!node) {
      throw new Error(
        `Unable to fire a "${key}" event - please provide a DOM element.`,
      )
    }
    const eventInit = {...defaultInit, ...init}
    const {target: {value, files, ...targetProperties} = {}} = eventInit
    if (value !== undefined) {
      setNativeValue(node, value)
    }
    if (files !== undefined) {
      // input.files is a read-only property so this is not allowed:
      // input.files = [file]
      // so we have to use this workaround to set the property
      Object.defineProperty(node, 'files', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: files,
      })
    }
    Object.assign(node, targetProperties)
    const window = getWindowFromNode(node)
    const EventConstructor = window[EventType] || window.Event
    let event
    /* istanbul ignore else  */
    if (typeof EventConstructor === 'function') {
      event = new EventConstructor(eventName, eventInit)
    } else {
      // IE11 polyfill from https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent#Polyfill
      event = window.document.createEvent(EventType)
      const {bubbles, cancelable, detail, ...otherInit} = eventInit
      event.initEvent(eventName, bubbles, cancelable, detail)
      Object.keys(otherInit).forEach(eventKey => {
        event[eventKey] = otherInit[eventKey]
      })
    }

    const {dataTransfer} = eventInit
    if (typeof dataTransfer === 'object') {
      // DataTransfer is not supported in jsdom: https://github.com/jsdom/jsdom/issues/1568
      /* istanbul ignore if  */
      if (typeof window.DataTransfer === 'function') {
        Object.defineProperty(event, 'dataTransfer', {
          value: Object.assign(new window.DataTransfer(), dataTransfer)
        })
      } else {
        Object.defineProperty(event, 'dataTransfer', {
          value: dataTransfer
        })
      }
    }
    return event
  }

  fireEvent[key] = (node, init) => fireEvent(node, createEvent[key](node, init))
})

// function written after some investigation here:
// https://github.com/facebook/react/issues/10135#issuecomment-401496776
function setNativeValue(element, value) {
  const {set: valueSetter} =
    Object.getOwnPropertyDescriptor(element, 'value') || {}
  const prototype = Object.getPrototypeOf(element)
  const {set: prototypeValueSetter} =
    Object.getOwnPropertyDescriptor(prototype, 'value') || {}
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value)
  } /* istanbul ignore next (I don't want to bother) */ else if (valueSetter) {
    valueSetter.call(element, value)
  } else {
    throw new Error('The given element does not have a value setter')
  }
}

Object.keys(eventAliasMap).forEach(aliasKey => {
  const key = eventAliasMap[aliasKey]
  fireEvent[aliasKey] = (...args) => fireEvent[key](...args)
})

export {fireEvent, createEvent}

/* eslint complexity:["error", 9] */
