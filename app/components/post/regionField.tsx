'use client'
/** Required region of a post: Global, a whole continent, or one country (regions table, misc DB).
 *  Countries are grouped under their continent; a post tagged with a country also shows up when
 *  readers filter the feed by that continent. */
import React from 'react'
import { regionGroups, useRegions } from '../../../lib/referenceData'
import { Field, inputCls } from './UI'

export default function RegionField({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const groups = regionGroups(useRegions())
  return (
    <Field label="Region" required>
      <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
        <option value="" disabled>Where is this post about?</option>
        {groups.map(({ parent, children }) => children.length === 0
          ? <option key={parent.code} value={parent.code}>{parent.name}</option>
          : (
            <optgroup key={parent.code} label={parent.name}>
              <option value={parent.code}>{parent.name} (whole continent)</option>
              {children.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </optgroup>
          ))}
      </select>
    </Field>
  )
}