import SurfaceCard from '../../../components/common/SurfaceCard'

function NativeModulePanels({ routePath, panels, renderPanel }) {
  if (!panels) {
    return null
  }

  return (
    <div className="native-module__panels">
      {panels.map((panel) => (
        <SurfaceCard key={`${routePath}-${panel.title}`} title={panel.title}>
          {renderPanel(panel)}
        </SurfaceCard>
      ))}
    </div>
  )
}

export default NativeModulePanels
