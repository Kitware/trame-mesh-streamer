from wslink.websocket import LinkProtocol


class ProgressiveMeshProtocol(LinkProtocol):
    def __init__(self):
        super().__init__()

    def publish_message(self, msg):
        self.publish("trame.progressive.topic.mesh", msg)
