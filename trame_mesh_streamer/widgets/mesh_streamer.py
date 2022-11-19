import asyncio
from trame.app import asynchronous
from trame_client.widgets.core import AbstractElement
from .. import module

from vtkmodules.vtkFiltersGeometryPreview import vtkPointSetToOctreeImageFilter
from vtkmodules.vtkCommonCore import vtkUnsignedIntArray


def to_camera_state(camera):
    if camera is None:
        return None

    return {
        "position": camera.GetPosition(),
        "viewUp": camera.GetViewUp(),
        "focalPoint": camera.GetFocalPoint(),
    }


def to_type(array):
    if array is None:
        return ""

    return array.GetClassName()


def byte_to_bit_count(v):
    count = 0
    if v & 1:
        count += 1
    if v & 2:
        count += 1
    if v & 4:
        count += 1
    if v & 8:
        count += 1
    if v & 16:
        count += 1
    if v & 32:
        count += 1
    if v & 64:
        count += 1
    if v & 128:
        count += 1

    return count


class HtmlElement(AbstractElement):
    def __init__(self, _elem_name, children=None, **kwargs):
        super().__init__(_elem_name, children, **kwargs)
        if self.server:
            self.server.enable_module(module)


# Expose your vue component(s)
class ProgressiveMesh(HtmlElement):
    _next_id = 0

    def __init__(
        self,
        input=None,
        chunk_size=5000000,
        points_per_bucket=8,
        sleep_time=0.1,
        **kwargs,
    ):
        ProgressiveMesh._next_id += 1
        self._uuid = str(ProgressiveMesh._next_id)
        super().__init__(
            "progressive-mesh",
            uuid=self._uuid,
            **kwargs,
        )
        self._attr_names += [
            "uuid",
            ("skip_octree", "skipOctree"),
        ]
        self._sleep_time = sleep_time
        self._chunk_size = chunk_size
        self._camera = None
        self._input = input
        self._summary_filter = vtkPointSetToOctreeImageFilter()
        self._summary_filter.SetNumberOfPointsPerCell(points_per_bucket)

        self.server.trigger(f"update_progressive_mesh_{self._uuid}")(self.force_push)

    def update(self, mesh=None, camera=None):
        self._camera = camera
        if mesh is not None and self._input != mesh:
            self._input = mesh

            if self._input.IsA("vtkPointSet"):
                self._summary_filter.SetInputData(self._input)
            else:
                self._summary_filter.SetInputConnection(self._input.GetOutputPort())

            self._send_description(camera=to_camera_state(camera))
            self._send_summary()
            asynchronous.create_task(self._stream_task())

    def force_push(self):
        if self._input is None:
            return
        self._send_description(camera=to_camera_state(self._camera))
        self._send_summary()
        asynchronous.create_task(self._stream_task())

    def _push(self, msg):
        self.server.controller.progressive_mesh_push(msg)

    def _send_description(self, **add_on):
        ds = self._input
        if ds.IsA("vtkAlgorithm"):
            ds.Update()
            ds = ds.GetOutput()
        msg = dict(
            uuid=self._uuid,
            type="metadata",
            points=ds.GetNumberOfPoints(),
            points_type=to_type(ds.GetPoints().GetData()),
            polys=ds.GetPolys().GetData().GetNumberOfTuples(),
            verts_type="vtkUnsignedIntArray",
            lines_type="vtkUnsignedIntArray",
            polys_type="vtkUnsignedIntArray",
            strips_type="vtkUnsignedIntArray",
            bounds=ds.GetBounds(),
            **add_on,
        )
        self._push(msg)

    def _send_summary(self):
        self._summary_filter.Update()
        partition_ds = self._summary_filter.GetOutput()
        size = partition_ds.GetNumberOfPartitions()
        if size != 1:
            raise RuntimeError(f"Invalid partition {size=}")

        ds = partition_ds.GetPartition(0)
        msg = dict(
            uuid=self._uuid,
            type="octree",
            dimensions=ds.GetDimensions(),
            origin=ds.GetOrigin(),
            spacing=ds.GetSpacing()[0],
            octree=self.server.protocol.addAttachment(
                memoryview(ds.GetCellData().GetArray("octree"))
            ),
        )
        self._push(msg)

    async def _stream_task(self):
        await asyncio.sleep(self._sleep_time)

        ds = self._input
        if hasattr(ds, "GetOutput"):
            ds.Update()
            ds = ds.GetOutput()

        # Points
        points = ds.GetPoints().GetData()
        buffer_type = "Float64Array" if points.IsA("vtkDoubleArray") else "Float32Array"
        src_offset = 0
        src_size = points.GetNumberOfTuples()

        # Polys
        poly_array = ds.GetPolys().GetData()
        poly_offset = 0
        poly_size = poly_array.GetNumberOfTuples()

        # Compute data size
        if buffer_type == "Float64Array":
            bytes_per_point = 8 * 3
        else:
            bytes_per_point = 4 * 3

        total_points_bytes = src_size * bytes_per_point
        total_polys_bytes = poly_size * 4
        max_points_buffer_size = 0
        max_polys_buffer_size = 0

        if poly_size == 0:
            max_points_buffer_size = int(self._chunk_size / bytes_per_point)
            max_polys_buffer_size = 1
        elif total_polys_bytes > total_points_bytes:
            poly_step = total_polys_bytes / total_points_bytes
            unit_size = bytes_per_point + poly_step * 4
            max_points_buffer_size = int(self._chunk_size / unit_size)
            max_polys_buffer_size = int(poly_step * max_points_buffer_size)
        elif total_polys_bytes < total_points_bytes:
            point_step = total_points_bytes / total_polys_bytes
            unit_size = point_step * bytes_per_point + 4
            max_polys_buffer_size = int(self._chunk_size / unit_size)
            max_points_buffer_size = int(point_step * max_polys_buffer_size)

        # print(f"{self._chunk_size=}, {total_points_bytes=}, {total_polys_bytes=}, {max_points_buffer_size=}, {max_polys_buffer_size=}")

        while src_offset < src_size:
            # Points
            buffer = points.NewInstance()
            buffer.SetNumberOfComponents(3)
            buffer_size = min(src_size - src_offset, max_points_buffer_size)
            buffer.Allocate(buffer_size * 3)
            buffer.InsertTuples(0, buffer_size, src_offset, points)
            src_offset += buffer_size

            msg = dict(
                uuid=self._uuid,
                type="xyz-chunk",
                xyz=self.server.protocol.addAttachment(memoryview(buffer)),
                array_type=buffer_type,
            )

            if poly_size:
                # Polys
                chunk_size = min(poly_size - poly_offset, max_polys_buffer_size)
                polys = vtkUnsignedIntArray()
                polys.Allocate(chunk_size)
                polys.InsertTuples(0, chunk_size, poly_offset, poly_array)
                poly_offset += chunk_size
                msg["polys"] = self.server.protocol.addAttachment(memoryview(polys))

            self._push(msg)
            await asyncio.sleep(self._sleep_time)

        # Send connectivity
        msg = dict(
            uuid=self._uuid,
            type="connectivity",
        )
        for name, array in [
            ("verts", ds.GetVerts().GetData()),
            ("lines", ds.GetLines().GetData()),
            ("strips", ds.GetStrips().GetData()),
        ]:
            dst = vtkUnsignedIntArray()
            dst.DeepCopy(array)
            msg[name] = self.server.protocol.addAttachment(memoryview(dst))

        # Custom handling of polys
        if poly_offset < poly_size:
            # print(f"{poly_offset=} {poly_size=} - delta={poly_size-poly_offset}")
            dst = vtkUnsignedIntArray()
            dst.InsertTuples(
                0, poly_size - poly_offset, poly_offset, ds.GetPolys().GetData()
            )
            msg["polys"] = self.server.protocol.addAttachment(memoryview(dst))

        self._push(msg)
