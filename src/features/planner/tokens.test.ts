import css from './Planner.css?raw'
import global from '../../App.css?raw'
import { expect, it } from 'vitest'
it('Planner references only declared design or event tokens', () => {
  const defined = new Set([...`${global}\n${css}`.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]))
  defined.add('--event-color')
  expect([...css.matchAll(/var\((--[\w-]+)/g)].map(match => match[1]).filter(token => !defined.has(token))).toEqual([])
})
