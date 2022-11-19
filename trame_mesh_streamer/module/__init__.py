from pathlib import Path
from ..protocol import ProgressiveMeshProtocol

serve_path = str(Path(__file__).with_name("serve").resolve())
serve = {"__trame_mesh_streamer": serve_path}
scripts = ["__trame_mesh_streamer/vue-trame_mesh_streamer.umd.min.js"]
vue_use = ["trame_mesh_streamer"]


def setup(server, **kwargs):
    def configure_protocol(root_protocol):
        protocol_instance = ProgressiveMeshProtocol()
        server.controller.progressive_mesh_push = protocol_instance.publish_message
        root_protocol.registerLinkProtocol(protocol_instance)

    server.add_protocol_to_configure(configure_protocol)
