from trame_mesh_streamer.widgets.mesh_streamer import *


def initialize(server):
    from trame_mesh_streamer import module

    server.enable_module(module)
