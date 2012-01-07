from five import grok
from pkg_resources import resource_filename
from zope.processlifetime import IProcessStarting
import deform

@grok.subscribe(IProcessStarting)
def register_widget_resources(event):
    """ Register the resources for the custom widgets """
    deform.widget.default_resource_registry.set_js_resources(\
                    'jquery.dynatree', None)
    own_templates = resource_filename(__name__, 'widget_templates')
    search_path = (own_templates, ) + \
        deform.Form.default_renderer.loader.search_path

    deform.Form.set_zpt_renderer(search_path)
