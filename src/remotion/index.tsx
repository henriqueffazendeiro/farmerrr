import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { RecapFilm, demoFilm } from '../components/recap/film'

const Root = () => <>
  <Composition id="RecapHorizontal" component={RecapFilm} durationInFrames={2700} fps={30} width={1920} height={1080} defaultProps={{ data: demoFilm, sound: true }} />
  <Composition id="RecapVertical" component={RecapFilm} durationInFrames={2700} fps={30} width={1080} height={1920} defaultProps={{ data: demoFilm, sound: true }} />
</>
registerRoot(Root)
