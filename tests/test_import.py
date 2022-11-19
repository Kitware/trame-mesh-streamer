def test_import():
    from trame_mesh_streamer.widgets.mesh_streamer import ProgressiveMesh  # noqa: F401

    # For components only, the CustomWidget is also importable via trame
    from trame.widgets.mesh_streamer import ProgressiveMesh  # noqa: F401,F811
