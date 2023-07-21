from pathlib import Path
from trame.app import get_server
from trame.widgets import vuetify, vtk as vtk_widgets, mesh_streamer
from trame.ui.vuetify import SinglePageLayout

from vtkmodules.vtkRenderingCore import (
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkPolyDataMapper,
    vtkActor,
)

from vtkmodules.vtkIOXML import vtkXMLPolyDataReader

# VTK factory initialization
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa
import vtkmodules.vtkRenderingOpenGL2  # noqa

OCTREE_BUCKET = 8
SLEEP_TIME = 0.1
CHUNK_SIZE = 5000000

# -----------------------------------------------------------------------------
# Trame initialization
# -----------------------------------------------------------------------------

server = get_server()
server.client_type = "vue2"
state, ctrl = server.state, server.controller

state.trame__title = "Progressive Geometry"

# CLI
server.cli.add_argument(
    "--data",
    help="Path to data file",
    dest="data",
    default=str(Path.home()),
)
args, _ = server.cli.parse_known_args()

# -----------------------------------------------------------------------------
# VTK code
# -----------------------------------------------------------------------------

renderer = vtkRenderer()
render_window = vtkRenderWindow()
render_window.AddRenderer(renderer)
render_window.OffScreenRenderingOn()

render_window_interactor = vtkRenderWindowInteractor()
render_window_interactor.SetRenderWindow(render_window)
render_window_interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

if args.data:
    reader = vtkXMLPolyDataReader()
    reader.SetFileName(args.data)
    mapper = vtkPolyDataMapper()
    actor = vtkActor()
    mapper.SetInputConnection(reader.GetOutputPort())
    actor.SetMapper(mapper)
    renderer.AddActor(actor)

renderer.ResetCamera()
render_window.Render()


@state.change("rendering_mode")
def on_rendering_change(rendering_mode, **kwargs):
    if rendering_mode == "Remote":
        ctrl.view_update_remote()
    elif rendering_mode == "Local":
        ctrl.view_update_local()
    elif rendering_mode == "Progressive":
        ctrl.mesh_update_progressive(reader, renderer.GetActiveCamera())


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------

with SinglePageLayout(server) as layout:
    layout.icon.click = ctrl.view_reset_camera
    layout.title.set_text("Progressive Geometry")

    with layout.toolbar:
        vuetify.VSpacer()
        vuetify.VProgressCircular(indeterminate=True, hide_details=True, dense=True)
        vuetify.VDivider(vertical=True, classes="mx-2")
        vuetify.VSelect(
            v_model=("rendering_mode", "Remote"),
            items=("['Remote', 'Local', 'Progressive']",),
            hide_details=True,
            dense=True,
            style="max-width: 150px;",
        )

    with layout.content:
        with vuetify.VContainer(
            fluid=True,
            classes="pa-0 fill-height",
        ):
            # Remote
            r_view = vtk_widgets.VtkRemoteView(
                render_window,
                interactive_ratio=1,
                v_show="rendering_mode === 'Remote'",
                ref="remote",
            )
            ctrl.view_update_remote = r_view.update
            ctrl.view_reset_camera.add(r_view.reset_camera)

            # Local
            l_view = vtk_widgets.VtkLocalView(
                render_window,
                v_if="rendering_mode === 'Local'",
                ref="local",
            )
            ctrl.view_update_local = l_view.update
            ctrl.view_reset_camera.add(l_view.reset_camera)

            # Progressive
            with vtk_widgets.VtkView(
                v_if="rendering_mode === 'Progressive'",
                ref="client",
            ) as c_view:
                ctrl.view_reset_camera.add(c_view.reset_camera)
                with vtk_widgets.VtkGeometryRepresentation():
                    mesh = mesh_streamer.ProgressiveMesh(
                        points_per_bucket=OCTREE_BUCKET,
                        chunk_size=CHUNK_SIZE,
                        sleep_time=SLEEP_TIME,
                    )  # skip_octree=True
                    ctrl.mesh_update_progressive = mesh.update


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    server.start()
